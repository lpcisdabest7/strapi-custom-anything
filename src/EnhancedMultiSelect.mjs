/**
 * Enhanced Multi-Select Component
 * Wraps the original multi-select input and adds:
 * - "+" button to add new options dynamically (stored in DB)
 * - "Manage" panel to view/remove options
 * - Auto-merges schema options + DB options
 * - Theme-aware: supports both light and dark Strapi themes
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

import ReactSelect from 'react-select';

const PLUGIN_API = 'dynamic-enum';

/* ─── Theme-aware Styled Components ─── */
const StyledSelect = styled.div`
  .ms-react-select__control {
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    border-radius: 4px;
    min-height: 40px;
    background: ${({ theme }) => theme.colors.neutral0};
    box-shadow: none;
    cursor: pointer;
  }
  .ms-react-select__control:hover {
    border-color: ${({ theme }) => theme.colors.neutral300};
  }
  .ms-react-select__control--is-focused {
    border-color: ${({ theme }) => theme.colors.primary600};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary600}40;
  }
  .ms-react-select__multi-value {
    background-color: ${({ theme }) => theme.colors.primary100};
    border: 1px solid ${({ theme }) => theme.colors.primary200};
    border-radius: 4px;
    margin: 2px 4px 2px 0;
  }
  .ms-react-select__multi-value__label {
    color: ${({ theme }) => theme.colors.primary600};
    font-size: 14px;
    padding: 2px 6px;
  }
  .ms-react-select__multi-value__remove {
    color: ${({ theme }) => theme.colors.primary600};
    cursor: pointer;
  }
  .ms-react-select__multi-value__remove:hover {
    background-color: ${({ theme }) => theme.colors.primary200};
    color: ${({ theme }) => theme.colors.primary700};
  }
  .ms-react-select__input-container {
    color: ${({ theme }) => theme.colors.neutral800};
  }
  .ms-react-select__placeholder {
    color: ${({ theme }) => theme.colors.neutral500};
  }
  .ms-react-select__menu {
    z-index: 5;
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    border-radius: 4px;
    background: ${({ theme }) => theme.colors.neutral0};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .ms-react-select__option {
    cursor: pointer;
    color: ${({ theme }) => theme.colors.neutral800};
    background: ${({ theme }) => theme.colors.neutral0};
  }
  .ms-react-select__option--is-focused {
    background-color: ${({ theme }) => theme.colors.primary100};
  }
  .ms-react-select__option--is-selected {
    background-color: ${({ theme }) => theme.colors.primary600};
    color: #fff;
  }
  .ms-react-select__indicator-separator {
    background-color: ${({ theme }) => theme.colors.neutral200};
  }
  .ms-react-select__dropdown-indicator,
  .ms-react-select__clear-indicator {
    color: ${({ theme }) => theme.colors.neutral500};
    &:hover {
      color: ${({ theme }) => theme.colors.neutral700};
    }
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
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary600};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary600}40;
  }
  &::placeholder {
    color: ${({ theme }) => theme.colors.neutral500};
  }
`;

const AddBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${({ theme }) => theme.colors.primary600};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.primary600};
  color: #fff;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.colors.primary700};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const ManageBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.neutral500};
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  &:hover {
    background: ${({ theme }) => theme.colors.neutral150};
    color: ${({ theme }) => theme.colors.primary600};
  }
`;

const ManagerBox = styled.div`
  margin-top: 4px;
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.neutral100};
  border-radius: 4px;
  border: 1px dashed ${({ theme }) => theme.colors.neutral300};
`;

const OptionChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  margin: 3px;
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.neutral800};
`;

const RemoveBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.danger600};
  opacity: 0.5;
  &:hover {
    opacity: 1;
  }
`;

const SchemaChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  margin: 3px;
  background: ${({ theme }) => theme.colors.neutral200};
  border: 1px solid ${({ theme }) => theme.colors.neutral300};
  border-radius: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.neutral600};
`;

const ManagerInfo = styled.div`
  margin-bottom: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.neutral600};
`;

const ManagerHint = styled.span`
  color: ${({ theme }) => theme.colors.neutral500};
`;

const EmptyText = styled.span`
  color: ${({ theme }) => theme.colors.neutral500};
  font-size: 13px;
`;

/* ─── Helper: extract field name from path ─── */
function extractGroupKey(name) {
  const parts = name.split('.');
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

        jsx(StyledSelect, {
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
        }),

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

        showManager && !disabled && jsx(ManagerBox, {
          children: jsxs(Fragment, {
            children: [
              jsxs(ManagerInfo, {
                children: [
                  'Group: ',
                  jsx('strong', { children: groupKey }),
                  ' — ',
                  jsx(ManagerHint, {
                    children: 'Schema options (gray) are defined in code. Dynamic options can be removed.',
                  }),
                ],
              }),
              jsx('div', {
                style: { display: 'flex', flexWrap: 'wrap' },
                children: jsxs(Fragment, {
                  children: [
                    ...schemaOptions.map(o =>
                      jsx(SchemaChip, { title: 'Defined in schema (read-only)', children: o.label }, `schema-${o.value}`)
                    ),
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
                    allOptions.length === 0 && jsx(EmptyText, {
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
