/**
 * Patched Enumeration Input for Strapi v5
 * Replaces @strapi/admin's built-in Enumeration.mjs
 *
 * Adds:
 * - "+" button to add new enum options dynamically (stored in DB)
 * - "Manage" panel to view/remove dynamic options
 * - Auto-merges schema options + DB options
 * - Theme-aware: supports both light and dark Strapi themes
 *
 * Original: @strapi/admin/dist/admin/admin/src/components/FormInputs/Enumeration.mjs
 */
import { jsxs, jsx } from 'react/jsx-runtime';
import { memo, forwardRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useComposedRefs, Field, SingleSelect, SingleSelectOption, Flex } from '@strapi/design-system';
import { Plus, Cross } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useFocusInputField } from '../../hooks/useFocusInputField.mjs';
import { useField } from '../Form.mjs';
import styled from 'styled-components';

const PLUGIN_API = 'dynamic-enum';

/* ─── Helper: auto-derive groupKey from field name ─── */
function extractGroupKey(name) {
  const parts = name.split('.');
  const nonNumeric = parts.filter(p => isNaN(Number(p)));
  return nonNumeric.join('_') || name;
}

/* ─── Lazy fetch client (avoid hook rules in styled-components) ─── */
let _fetchClient = null;
function getFetchClient() {
  if (!_fetchClient) {
    try {
      // Dynamic import to avoid circular deps
      const mod = require('@strapi/strapi/admin');
      // We'll use fetch directly instead
    } catch {}
  }
  return _fetchClient;
}

/* ─── Theme-aware Styled Components ─── */
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

/* ─── Enhanced Enumeration Component ─── */
const EnumerationInput = forwardRef(({ name, required, label, hint, labelAction, options = [], ...props }, ref) => {
  const { formatMessage } = useIntl();
  const field = useField(name);
  const fieldRef = useFocusInputField(name);
  const composedRefs = useComposedRefs(ref, fieldRef);

  const groupKey = extractGroupKey(name);

  const [dbOptions, setDbOptions] = useState([]);
  const [newValue, setNewValue] = useState('');
  const [showManager, setShowManager] = useState(false);

  // Fetch DB options via raw fetch (admin API)
  const fetchDbOptions = useCallback(async () => {
    try {
      const token = JSON.parse(sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken') || '""');
      const res = await fetch(`/admin/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setDbOptions(Array.isArray(json?.data) ? json.data : []);
      }
    } catch {
      setDbOptions([]);
    }
  }, [groupKey]);

  useEffect(() => { fetchDbOptions(); }, [fetchDbOptions]);

  // Schema options (from content-type enum definition)
  const schemaOptionValues = useMemo(() => {
    return options.map(o => o.value || o).filter(Boolean);
  }, [options]);

  const schemaValueSet = useMemo(() => new Set(schemaOptionValues), [schemaOptionValues]);

  // Merge: schema options + DB options (deduplicated)
  const allOptions = useMemo(() => {
    const merged = [...options];
    dbOptions.forEach(val => {
      if (!schemaValueSet.has(val)) {
        merged.push({ value: val, label: val });
      }
    });
    return merged;
  }, [options, dbOptions, schemaValueSet]);

  // Add new option
  const handleAddOption = useCallback(async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    try {
      const token = JSON.parse(sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken') || '""');
      const res = await fetch(`/admin/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: trimmed }),
      });
      if (res.ok) {
        const json = await res.json();
        setDbOptions(Array.isArray(json?.data) ? json.data : []);
        setNewValue('');
      }
    } catch (err) {
      console.error('[dynamic-enum] add failed:', err);
    }
  }, [groupKey, newValue]);

  // Remove DB option
  const handleRemoveDbOption = useCallback(async (optVal) => {
    try {
      const token = JSON.parse(sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken') || '""');
      const res = await fetch(`/admin/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}/${encodeURIComponent(optVal)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setDbOptions(Array.isArray(json?.data) ? json.data : []);
        if (field.value === optVal) {
          field.onChange(name, null);
        }
      }
    } catch (err) {
      console.error('[dynamic-enum] remove failed:', err);
    }
  }, [groupKey, field, name]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); }
  }, [handleAddOption]);

  return jsxs(Field.Root, {
    error: field.error,
    name: name,
    hint: hint,
    required: required,
    children: [
      jsx(Field.Label, {
        action: labelAction,
        children: label,
      }),

      // Original SingleSelect with merged options
      jsxs(SingleSelect, {
        ref: composedRefs,
        onChange: (value) => {
          field.onChange(name, value === '' ? null : value);
        },
        value: field.value,
        ...props,
        children: [
          jsx(SingleSelectOption, {
            value: '',
            disabled: required,
            hidden: required,
            children: formatMessage({
              id: 'components.InputSelect.option.placeholder',
              defaultMessage: 'Choose here',
            }),
          }),
          allOptions.map(({ value, label, disabled, hidden }) => {
            return jsx(SingleSelectOption, {
              value: value,
              disabled: disabled,
              hidden: hidden,
              children: label ?? value,
            }, value);
          }),
        ],
      }),

      // Add row: input + "+" button + manage button
      jsx(AddRow, {
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

      // Manager panel
      showManager && jsx(ManagerBox, {
        children: [
          jsxs(ManagerInfo, {
            children: [
              'Group: ',
              jsx('strong', { children: groupKey }),
              ' — ',
              jsx(ManagerHint, {
                children: 'Schema options (gray) are read-only. Dynamic options can be removed.',
              }),
            ],
          }),
          jsx('div', {
            style: { display: 'flex', flexWrap: 'wrap' },
            children: [
              ...schemaOptionValues.map(val =>
                jsx(SchemaChip, { title: 'Defined in schema (read-only)', children: val }, `schema-${val}`)
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
              allOptions.length === 0 && jsx(EmptyText, { children: 'No options yet.' }),
            ],
          }),
        ],
      }),

      jsx(Field.Hint, {}),
      jsx(Field.Error, {}),
    ],
  });
});

const MemoizedEnumerationInput = memo(EnumerationInput);

export { MemoizedEnumerationInput as EnumerationInput };
