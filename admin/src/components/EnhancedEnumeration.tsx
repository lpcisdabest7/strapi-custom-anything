/**
 * Enhanced Enumeration Component
 * Replaces Strapi's built-in enumeration input via app.addFields()
 *
 * - Renders the original SingleSelect dropdown with enum options
 * - Adds "+" button to create new options dynamically (stored in DB)
 * - "Manage" panel to view/remove dynamic options
 * - Auto-merges schema enum + DB options
 * - Theme-aware: supports light and dark Strapi themes
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Field, SingleSelect, SingleSelectOption } from '@strapi/design-system';
import { Plus, Cross } from '@strapi/icons';
import { useField } from '@strapi/strapi/admin';
import styled from 'styled-components';

const PLUGIN_API = 'dynamic-enum';

/**
 * Build a stable groupKey from the Strapi field `name` prop.
 *
 * The `name` prop looks like: "screens.0.categories.0.cardPreviews.0.role"
 * We strip numeric indices to get: "cardPreviews.role"
 * This gives a stable key that identifies the component field regardless of
 * which content entry or array index it appears in.
 *
 * Examples:
 *   "screens.0.categories.0.cardPreviews.0.role" → "cardPreviews.role"
 *   "screens.0.categories.0.styles.0.cardPreviews.0.role" → "cardPreviews.role"
 *   "role" → "role" (top-level field)
 *
 * The last TWO non-numeric segments are used (parent + field) to provide
 * component-level grouping. If the field has the same parent across different
 * component types (e.g., cardPreviews.role in both vsl and boopix), they share options.
 */
function getGroupKey(name: string): string {
  const parts = name.split('.').filter((p) => isNaN(Number(p)));
  // Use last 2 segments for component context: "cardPreviews.role"
  // Or just the field name if it's a top-level field
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  }
  return parts[parts.length - 1] || name;
}

/**
 * Raw fetch helper that bypasses useFetchClient (which adds /admin prefix).
 * Plugin admin routes are at /{pluginName}/options/:groupKey (no /admin prefix).
 */
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken') || '""';
    const token = JSON.parse(raw);
    if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  } catch {}
  return { 'Content-Type': 'application/json' };
}

function getApiUrl(groupKey: string, optionValue?: string): string {
  const origin = window.location.origin;
  const base = `${origin}/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}`;
  return optionValue ? `${base}/${encodeURIComponent(optionValue)}` : base;
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

/* ─── Main Component ─── */
const EnhancedEnumeration = ({
  name,
  label,
  hint,
  required,
  disabled,
  attribute,
  labelAction,
  ...props
}: any) => {
  const { formatMessage } = useIntl();
  const field = useField(name);
  const groupKey = getGroupKey(name);

  const [dbOptions, setDbOptions] = useState<string[]>([]);
  const [newValue, setNewValue] = useState('');
  const [showManager, setShowManager] = useState(false);

  const schemaEnumValues: string[] = useMemo(() => {
    return attribute?.enum || [];
  }, [attribute]);

  const schemaValueSet = useMemo(() => new Set(schemaEnumValues), [schemaEnumValues]);

  // Fetch DB options via raw fetch (bypass useFetchClient /admin prefix issue)
  const fetchDbOptions = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(groupKey), { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setDbOptions(Array.isArray(json?.data) ? json.data : []);
      }
    } catch {
      setDbOptions([]);
    }
  }, [groupKey]);

  useEffect(() => {
    fetchDbOptions();
  }, [fetchDbOptions]);

  const allValues = useMemo(() => {
    const merged = [...schemaEnumValues];
    dbOptions.forEach((val) => {
      if (!schemaValueSet.has(val)) {
        merged.push(val);
      }
    });
    return merged;
  }, [schemaEnumValues, dbOptions, schemaValueSet]);

  const handleAddOption = useCallback(async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(getApiUrl(groupKey), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: trimmed }),
      });
      if (res.ok) {
        const json = await res.json();
        setDbOptions(Array.isArray(json?.data) ? json.data : []);
        setNewValue('');
      } else {
        console.error('[dynamic-enum] add failed:', res.status, await res.text());
      }
    } catch (err) {
      console.error('[dynamic-enum] add failed:', err);
    }
  }, [groupKey, newValue]);

  const handleRemoveDbOption = useCallback(
    async (optVal: string) => {
      try {
        const res = await fetch(getApiUrl(groupKey, optVal), {
          method: 'DELETE',
          headers: getAuthHeaders(),
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
    },
    [groupKey, field, name]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddOption();
      }
    },
    [handleAddOption]
  );

  return (
    <Field.Root error={field.error} name={name} hint={hint} required={required}>
      <Field.Label action={labelAction}>{label}</Field.Label>

      <SingleSelect
        onChange={(value: string) => {
          field.onChange(name, value === '' ? null : value);
        }}
        value={field.value}
        disabled={disabled}
      >
        <SingleSelectOption value="" disabled={required} hidden={required}>
          {formatMessage({
            id: 'components.InputSelect.option.placeholder',
            defaultMessage: 'Choose here',
          })}
        </SingleSelectOption>
        {allValues.map((val) => (
          <SingleSelectOption key={val} value={val}>
            {val}
          </SingleSelectOption>
        ))}
      </SingleSelect>

      {!disabled && (
        <AddRow>
          <AddInput
            placeholder="New option..."
            value={newValue}
            onChange={(e: any) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <AddBtn onClick={handleAddOption} disabled={!newValue.trim()} title="Add option">
            <Plus width={16} height={16} />
          </AddBtn>
          <ManageBtn onClick={() => setShowManager(!showManager)}>
            {showManager ? 'Hide' : `Manage (${allValues.length})`}
          </ManageBtn>
        </AddRow>
      )}

      {showManager && !disabled && (
        <ManagerBox>
          <ManagerInfo>
            Group: <strong>{groupKey}</strong> —{' '}
            <ManagerHint>
              Schema options (gray) are read-only. Dynamic options can be removed.
            </ManagerHint>
          </ManagerInfo>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {schemaEnumValues.map((val) => (
              <SchemaChip key={`schema-${val}`} title="Defined in schema (read-only)">
                {val}
              </SchemaChip>
            ))}
            {dbOptions
              .filter((val) => !schemaValueSet.has(val))
              .map((val) => (
                <OptionChip key={`db-${val}`}>
                  {val}
                  <RemoveBtn onClick={() => handleRemoveDbOption(val)} title={`Remove "${val}"`}>
                    <Cross width={10} height={10} />
                  </RemoveBtn>
                </OptionChip>
              ))}
          </div>
        </ManagerBox>
      )}

      <Field.Hint />
      <Field.Error />
    </Field.Root>
  );
};

export default EnhancedEnumeration;
