import { useState, useMemo, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';
import { Field, Flex, IconButton, TextInput, Box, Typography, Tag } from '@strapi/design-system';
import { Plus, Cross } from '@strapi/icons';
import { useFetchClient, useField } from '@strapi/strapi/admin';
import Select from 'react-select';
import styled from 'styled-components';

const PLUGIN_ID = 'dynamic-enum';

/* ────────────────────── Styled Components ────────────────────── */

const StyledSelect = styled(Select)`
  .react-select__control {
    border: 1px solid ${({ theme }) => theme.colors?.neutral200 || '#dcdce4'};
    border-radius: 4px;
    min-height: 40px;
    background: ${({ theme }) => theme.colors?.neutral0 || '#ffffff'};
    box-shadow: none;
    &:hover {
      border-color: ${({ theme }) => theme.colors?.neutral300 || '#c0c0cf'};
    }
    &--is-focused {
      border-color: ${({ theme }) => theme.colors?.primary600 || '#4945ff'};
      box-shadow: ${({ theme }) => theme.colors?.primary600 || '#4945ff'} 0px 0px 0px 2px;
    }
  }
  .react-select__multi-value {
    background-color: ${({ theme }) => theme.colors?.primary100 || '#f0f0ff'};
    border: 1px solid ${({ theme }) => theme.colors?.primary200 || '#d9d8ff'};
    border-radius: 4px;
    margin: 2px 4px 2px 0;
  }
  .react-select__multi-value__label {
    color: ${({ theme }) => theme.colors?.primary600 || '#4945ff'};
    font-size: 14px;
    padding: 2px 6px;
  }
  .react-select__multi-value__remove {
    color: ${({ theme }) => theme.colors?.primary600 || '#4945ff'};
    cursor: pointer;
    &:hover {
      background-color: ${({ theme }) => theme.colors?.primary200 || '#d9d8ff'};
      color: ${({ theme }) => theme.colors?.primary700 || '#271fe0'};
    }
  }
  .react-select__placeholder {
    color: ${({ theme }) => theme.colors?.neutral500 || '#8e8ea9'};
  }
  .react-select__menu {
    z-index: 5;
    border: 1px solid ${({ theme }) => theme.colors?.neutral200 || '#dcdce4'};
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .react-select__option {
    cursor: pointer;
    &--is-focused {
      background-color: ${({ theme }) => theme.colors?.primary100 || '#f0f0ff'};
    }
    &--is-selected {
      background-color: ${({ theme }) => theme.colors?.primary600 || '#4945ff'};
    }
  }
`;

const AddOptionRow = styled(Flex)`
  padding: 8px 0;
  gap: 8px;
`;

const OptionsManagerBox = styled(Box)`
  margin-top: 4px;
  padding: 8px 12px;
  background: ${({ theme }) => theme.colors?.neutral100 || '#f6f6f9'};
  border-radius: 4px;
  border: 1px dashed ${({ theme }) => theme.colors?.neutral300 || '#c0c0cf'};
`;

const OptionTag = styled(Flex)`
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${({ theme }) => theme.colors?.neutral0 || '#ffffff'};
  border: 1px solid ${({ theme }) => theme.colors?.neutral200 || '#dcdce4'};
  border-radius: 4px;
  font-size: 13px;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors?.danger600 || '#d02b20'};
  opacity: 0.6;
  &:hover {
    opacity: 1;
  }
`;

/* ────────────────────── Main Component ────────────────────── */

interface DynamicEnumInputProps {
  name: string;
  attribute: any;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  description?: any;
  intlLabel?: any;
}

const DynamicEnumInput = ({
  name,
  attribute,
  label,
  hint,
  required,
  disabled,
  placeholder,
  intlLabel,
}: DynamicEnumInputProps) => {
  const { formatMessage } = useIntl();
  const { onChange, value, error } = useField(name);
  const { get, post, del } = useFetchClient();

  const groupKey: string = attribute?.options?.groupKey || attribute?.customFieldConfig?.groupKey || name;

  const [availableOptions, setAvailableOptions] = useState<string[]>([]);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [showManager, setShowManager] = useState(false);

  // Fetch options from server
  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await get(`/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}`);
      setAvailableOptions(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error('[dynamic-enum] Failed to fetch options:', err);
      setAvailableOptions([]);
    } finally {
      setLoading(false);
    }
  }, [get, groupKey]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Parse current value
  const selectedValues = useMemo(() => {
    let parsed: string[];
    try {
      parsed = typeof value !== 'string' ? value || [] : JSON.parse(value || '[]');
    } catch {
      parsed = [];
    }
    return Array.isArray(parsed) ? parsed : [];
  }, [value]);

  // Build select options
  const selectOptions = useMemo(() => {
    return availableOptions.map((opt) => ({ label: opt, value: opt }));
  }, [availableOptions]);

  const selectedSelectValues = useMemo(() => {
    return selectedValues
      .map((val) => selectOptions.find((opt) => opt.value === val))
      .filter(Boolean);
  }, [selectedValues, selectOptions]);

  // Handle selection change
  const handleChange = useCallback(
    (selected: any) => {
      const newValues = selected ? selected.map((s: any) => s.value) : [];
      onChange(name, JSON.stringify(newValues));
    },
    [onChange, name]
  );

  // Add new option
  const handleAddOption = useCallback(async () => {
    const trimmed = newOptionValue.trim();
    if (!trimmed) return;

    try {
      const { data } = await post(`/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}`, {
        value: trimmed,
      });
      setAvailableOptions(Array.isArray(data?.data) ? data.data : []);
      setNewOptionValue('');
    } catch (err: any) {
      console.error('[dynamic-enum] Failed to add option:', err);
    }
  }, [post, groupKey, newOptionValue]);

  // Remove option from available list
  const handleRemoveOption = useCallback(
    async (optionValue: string) => {
      try {
        const { data } = await del(
          `/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}/${encodeURIComponent(optionValue)}`
        );
        setAvailableOptions(Array.isArray(data?.data) ? data.data : []);
        // Also remove from selected values if present
        const newSelected = selectedValues.filter((v) => v !== optionValue);
        if (newSelected.length !== selectedValues.length) {
          onChange(name, JSON.stringify(newSelected));
        }
      } catch (err) {
        console.error('[dynamic-enum] Failed to remove option:', err);
      }
    },
    [del, groupKey, selectedValues, onChange, name]
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

  const displayLabel = label || (intlLabel ? formatMessage(intlLabel) : name);

  return (
    <Field.Root hint={hint} error={error} name={name} required={required}>
      <Flex direction="column" alignItems="stretch" gap={1}>
        <Field.Label>{displayLabel}</Field.Label>

        <StyledSelect
          isMulti
          isSearchable
          isDisabled={disabled}
          isLoading={loading}
          name={name}
          options={selectOptions}
          value={selectedSelectValues}
          onChange={handleChange}
          placeholder={placeholder || 'Select...'}
          classNamePrefix="react-select"
          noOptionsMessage={() => 'No options available. Click + to add new options.'}
        />

        {/* Add new option inline */}
        {!disabled && (
          <AddOptionRow alignItems="center">
            <Box style={{ flex: 1 }}>
              <TextInput
                aria-label="New option value"
                placeholder="Type new option..."
                value={newOptionValue}
                onChange={(e: any) => setNewOptionValue(e.target.value)}
                onKeyDown={handleKeyDown}
                size="S"
              />
            </Box>
            <IconButton
              onClick={handleAddOption}
              label="Add option"
              disabled={!newOptionValue.trim()}
              variant="secondary"
              size="S"
            >
              <Plus />
            </IconButton>
            <IconButton
              onClick={() => setShowManager(!showManager)}
              label={showManager ? 'Hide options manager' : 'Manage options'}
              variant="ghost"
              size="S"
            >
              <Typography variant="pi" textColor="neutral600">
                {showManager ? 'Hide' : `Manage (${availableOptions.length})`}
              </Typography>
            </IconButton>
          </AddOptionRow>
        )}

        {/* Options Manager - show all available options with delete */}
        {showManager && !disabled && (
          <OptionsManagerBox>
            <Typography variant="sigma" textColor="neutral600" style={{ marginBottom: 8, display: 'block' }}>
              Available options for group: <strong>{groupKey}</strong>
            </Typography>
            <Flex wrap="wrap" gap={2}>
              {availableOptions.length === 0 && (
                <Typography variant="pi" textColor="neutral500">
                  No options yet. Add one above.
                </Typography>
              )}
              {availableOptions.map((opt) => (
                <OptionTag key={opt}>
                  <span>{opt}</span>
                  <RemoveButton
                    type="button"
                    onClick={() => handleRemoveOption(opt)}
                    title={`Remove "${opt}"`}
                  >
                    <Cross width={10} height={10} />
                  </RemoveButton>
                </OptionTag>
              ))}
            </Flex>
          </OptionsManagerBox>
        )}

        <Field.Hint />
        <Field.Error />
      </Flex>
    </Field.Root>
  );
};

export default DynamicEnumInput;
