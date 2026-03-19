/**
 * Enhanced Multi-Select Component
 * Wraps the original multi-select input and adds:
 * - "+" button to add new options dynamically (stored in DB)
 * - "Manage" panel to view/remove options
 * - Auto-merges schema options + DB options
 *
 * groupKey is auto-derived from the field name for global sharing.
 */
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Field, Flex, Box, Typography } from '@strapi/design-system';
import { Cross, Plus } from '@strapi/icons';
import { useField, useFetchClient } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';
import styled from 'styled-components';

/* ─── react-select (inline lightweight version) ─── */
/* We import react-select from the same bundled version strapi uses */
let ReactSelect;
try {
  ReactSelect = await import('react-select').then(m => m.default || m);
} catch {
  // fallback: try require
  try { ReactSelect = require('react-select'); ReactSelect = ReactSelect.default || ReactSelect; } catch { ReactSelect = null; }
}

const PLUGIN_API = 'dynamic-enum';

/* ─── Styled Components ─── */
const StyledSelect = styled.div`
  .ms-react-select__control {
    border: 1px solid #dcdce4;
    border-radius: 4px;
    min-height: 40px;
    background: #ffffff;
    box-shadow: none;
    cursor: pointer;
  }
  .ms-react-select__control:hover {
    border-color: #c0c0cf;
  }
  .ms-react-select__control--is-focused {
    border-color: #4945ff;
    box-shadow: 0 0 0 2px #4945ff40;
  }
  .ms-react-select__multi-value {
    background-color: #f0f0ff;
    border: 1px solid #d9d8ff;
    border-radius: 4px;
    margin: 2px 4px 2px 0;
  }
  .ms-react-select__multi-value__label {
    color: #4945ff;
    font-size: 14px;
    padding: 2px 6px;
  }
  .ms-react-select__multi-value__remove {
    color: #4945ff;
    cursor: pointer;
  }
  .ms-react-select__multi-value__remove:hover {
    background-color: #d9d8ff;
    color: #271fe0;
  }
  .ms-react-select__placeholder {
    color: #8e8ea9;
  }
  .ms-react-select__menu {
    z-index: 5;
    border: 1px solid #dcdce4;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .ms-react-select__option {
    cursor: pointer;
  }
  .ms-react-select__option--is-focused {
    background-color: #f0f0ff;
  }
  .ms-react-select__option--is-selected {
    background-color: #4945ff;
    color: #fff;
  }
`;

const AddRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
`;

const AddInput = styled.input`
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #dcdce4;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  &:focus { border-color: #4945ff; box-shadow: 0 0 0 2px #4945ff40; }
  &::placeholder { color: #8e8ea9; }
`;

const AddBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #4945ff;
  border-radius: 4px;
  background: #4945ff;
  color: #fff;
  cursor: pointer;
  &:hover { background: #271fe0; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ManageBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #8e8ea9;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  &:hover { background: #f6f6f9; color: #4945ff; }
`;

const ManagerBox = styled.div`
  margin-top: 4px;
  padding: 10px 12px;
  background: #f6f6f9;
  border-radius: 4px;
  border: 1px dashed #c0c0cf;
`;

const OptionChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  margin: 3px;
  background: #fff;
  border: 1px solid #dcdce4;
  border-radius: 4px;
  font-size: 13px;
`;

const RemoveBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: #d02b20;
  opacity: 0.5;
  &:hover { opacity: 1; }
`;

const SchemaChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  margin: 3px;
  background: #dcdce4;
  border: 1px solid #c0c0cf;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
`;

/* ─── Helper: extract field name from path ─── */
function extractGroupKey(name) {
  // name can be like "tags", "styles.0.tags", "categories.2.display"
  // Extract the last segment as groupKey
  const parts = name.split('.');
  // Filter out numeric indices
  const nonNumeric = parts.filter(p => isNaN(Number(p)));
  return nonNumeric.join('_') || name;
}

/* ─── Main Component ─── */
const EnhancedMultiSelect = ({
  hint,
  label,
  name,
  intlLabel,
  required,
  attribute,
  description,
  placeholder,
  disabled,
}) => {
  const { formatMessage } = useIntl();
  const { onChange, value, error } = useField(name);
  const { get, post, del } = useFetchClient();

  const groupKey = extractGroupKey(name);

  const [dbOptions, setDbOptions] = useState([]);
  const [newValue, setNewValue] = useState('');
  const [showManager, setShowManager] = useState(false);
  const [loading, setLoading] = useState(false);

  // Schema options (from content-type builder config)
  const schemaOptions = useMemo(() => {
    return (attribute?.options || [])
      .map(opt => {
        if (typeof opt === 'string') {
          const [lbl, val] = [...opt.split(/:(.*)/s), opt];
          return (lbl && val) ? { label: lbl, value: val } : null;
        }
        return null;
      })
      .filter(Boolean);
  }, [attribute]);

  // Fetch DB options
  const fetchDbOptions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await get(`/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}`);
      setDbOptions(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setDbOptions([]);
    } finally {
      setLoading(false);
    }
  }, [get, groupKey]);

  useEffect(() => { fetchDbOptions(); }, [fetchDbOptions]);

  // Merge schema + DB options (deduplicated)
  const allOptions = useMemo(() => {
    const merged = new Map();
    schemaOptions.forEach(o => merged.set(o.value, o));
    dbOptions.forEach(val => {
      if (!merged.has(val)) {
        merged.set(val, { label: val, value: val });
      }
    });
    return Array.from(merged.values());
  }, [schemaOptions, dbOptions]);

  // Parse current selected value
  const selectedValues = useMemo(() => {
    let parsed;
    try {
      parsed = typeof value !== 'string' ? (value || []) : JSON.parse(value || '[]');
    } catch { parsed = []; }
    return Array.isArray(parsed) ? parsed : [];
  }, [value]);

  const selectedSelectValues = useMemo(() => {
    return selectedValues
      .map(val => allOptions.find(o => o.value === val) || { label: val, value: val })
      .filter(Boolean);
  }, [selectedValues, allOptions]);

  // Handlers
  const handleChange = useCallback((selected) => {
    const newVals = selected ? selected.map(s => s.value) : [];
    onChange(name, JSON.stringify(newVals));
  }, [onChange, name]);

  const handleAddOption = useCallback(async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    try {
      const { data } = await post(`/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}`, {
        value: trimmed,
      });
      setDbOptions(Array.isArray(data?.data) ? data.data : []);
      setNewValue('');
    } catch (err) {
      console.error('[dynamic-enum] add failed:', err);
    }
  }, [post, groupKey, newValue]);

  const handleRemoveDbOption = useCallback(async (optVal) => {
    try {
      const { data } = await del(
        `/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}/${encodeURIComponent(optVal)}`
      );
      setDbOptions(Array.isArray(data?.data) ? data.data : []);
      // Also deselect if selected
      const newSelected = selectedValues.filter(v => v !== optVal);
      if (newSelected.length !== selectedValues.length) {
        onChange(name, JSON.stringify(newSelected));
      }
    } catch (err) {
      console.error('[dynamic-enum] remove failed:', err);
    }
  }, [del, groupKey, selectedValues, onChange, name]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); }
  }, [handleAddOption]);

  // Validation
  const fieldError = useMemo(() => {
    if (error) return error;
    const { min, max } = attribute || {};
    if (required && selectedValues.length === 0) return 'This field is required';
    if (min && selectedValues.length < min && (required || selectedValues.length > 0))
      return `Select at least ${min} options`;
    if (max && selectedValues.length > max)
      return `Select at most ${max} options`;
    return null;
  }, [required, error, selectedValues, attribute]);

  const displayLabel = label || (intlLabel ? formatMessage(intlLabel) : name);
  const schemaValueSet = new Set(schemaOptions.map(o => o.value));

  return jsx(Field.Root, {
    hint,
    error: fieldError,
    name,
    required,
    children: jsxs(Flex, {
      direction: 'column',
      alignItems: 'stretch',
      gap: 1,
      children: [
        jsx(Field.Label, { children: displayLabel }),

        // Select
        ReactSelect
          ? jsx(StyledSelect, {
              children: jsx(ReactSelect, {
                isMulti: true,
                isSearchable: true,
                isDisabled: disabled,
                isLoading: loading,
                name,
                options: allOptions,
                value: selectedSelectValues,
                onChange: handleChange,
                placeholder: placeholder || 'Select...',
                classNamePrefix: 'ms-react-select',
                noOptionsMessage: () => 'No options. Add one below.',
              }),
            })
          : jsx('div', { children: 'react-select not available' }),

        // Add row
        !disabled && jsx(AddRow, {
          children: jsxs(Fragment, {
            children: [
              jsx(AddInput, {
                placeholder: 'New option...',
                value: newValue,
                onChange: (e) => setNewValue(e.target.value),
                onKeyDown: handleKeyDown,
              }),
              jsx(AddBtn, {
                onClick: handleAddOption,
                disabled: !newValue.trim(),
                title: 'Add option',
                children: jsx(Plus, { width: 16, height: 16 }),
              }),
              jsx(ManageBtn, {
                onClick: () => setShowManager(!showManager),
                children: showManager ? 'Hide' : `Manage (${allOptions.length})`,
              }),
            ],
          }),
        }),

        // Manager panel
        showManager && !disabled && jsx(ManagerBox, {
          children: jsxs(Fragment, {
            children: [
              jsx('div', {
                style: { marginBottom: 8, fontSize: 12, color: '#666' },
                children: jsxs(Fragment, {
                  children: [
                    'Group: ',
                    jsx('strong', { children: groupKey }),
                    ' — ',
                    jsx('span', {
                      style: { color: '#999' },
                      children: 'Schema options (gray) are defined in code. Dynamic options (white) can be removed.',
                    }),
                  ],
                }),
              }),
              jsx('div', {
                style: { display: 'flex', flexWrap: 'wrap' },
                children: jsxs(Fragment, {
                  children: [
                    // Schema options (non-removable)
                    ...schemaOptions.map(o =>
                      jsx(SchemaChip, { title: 'Defined in schema (read-only)', children: o.label }, `schema-${o.value}`)
                    ),
                    // DB options (removable)
                    ...dbOptions
                      .filter(val => !schemaValueSet.has(val))
                      .map(val =>
                        jsxs(OptionChip, {
                          children: [
                            val,
                            jsx(RemoveBtn, {
                              onClick: () => handleRemoveDbOption(val),
                              title: `Remove "${val}"`,
                              children: jsx(Cross, { width: 10, height: 10 }),
                            }),
                          ],
                        }, `db-${val}`)
                      ),
                    allOptions.length === 0 && jsx('span', {
                      style: { color: '#8e8ea9', fontSize: 13 },
                      children: 'No options yet.',
                    }),
                  ],
                }),
              }),
            ],
          }),
        }),

        jsx(Field.Hint, {}),
        jsx(Field.Error, {}),
      ],
    }),
  });
};

export { EnhancedMultiSelect };
export default EnhancedMultiSelect;
