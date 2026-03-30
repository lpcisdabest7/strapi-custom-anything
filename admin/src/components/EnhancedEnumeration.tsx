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
import { useField, useFetchClient } from '@strapi/strapi/admin';
import styled from 'styled-components';

const PLUGIN_API = 'dynamic-enum';

function extractGroupKey(name: string): string {
  const parts = name.split('.');
  const nonNumeric = parts.filter((p) => isNaN(Number(p)));
  return nonNumeric.join('_') || name;
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
  const { get, post, del } = useFetchClient();
  const groupKey = extractGroupKey(name);

  const [dbOptions, setDbOptions] = useState<string[]>([]);
  const [newValue, setNewValue] = useState('');
  const [showManager, setShowManager] = useState(false);

  const schemaEnumValues: string[] = useMemo(() => {
    return attribute?.enum || [];
  }, [attribute]);

  const schemaValueSet = useMemo(() => new Set(schemaEnumValues), [schemaEnumValues]);

  // Fetch DB options via useFetchClient (handles auth + prefix automatically)
  const fetchDbOptions = useCallback(async () => {
    try {
      const { data } = await get(`/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}`);
      setDbOptions(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setDbOptions([]);
    }
  }, [get, groupKey]);

  useEffect(() => {
    fetchDbOptions();
  }, [fetchDbOptions]);

  // Merge schema enum + DB options
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
      const { data } = await post(
        `/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}`,
        { value: trimmed }
      );
      setDbOptions(Array.isArray(data?.data) ? data.data : []);
      setNewValue('');
    } catch (err) {
      console.error('[dynamic-enum] add failed:', err);
    }
  }, [post, groupKey, newValue]);

  const handleRemoveDbOption = useCallback(
    async (optVal: string) => {
      try {
        const { data } = await del(
          `/${PLUGIN_API}/options/${encodeURIComponent(groupKey)}/${encodeURIComponent(optVal)}`
        );
        setDbOptions(Array.isArray(data?.data) ? data.data : []);
        if (field.value === optVal) {
          field.onChange(name, null);
        }
      } catch (err) {
        console.error('[dynamic-enum] remove failed:', err);
      }
    },
    [del, groupKey, field, name]
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
