import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { V as Vm, T, R, X as X0, s as st, a as sn, I, C as C5 } from "./index-Bq2zy9JD.mjs";
import { useField, useFetchClient } from "@strapi/strapi/admin";
import Select from "react-select";
import styled from "styled-components";
const PLUGIN_ID = "dynamic-enum";
const StyledSelect = styled(Select)`
  .react-select__control {
    border: 1px solid ${({ theme }) => theme.colors?.neutral200 || "#dcdce4"};
    border-radius: 4px;
    min-height: 40px;
    background: ${({ theme }) => theme.colors?.neutral0 || "#ffffff"};
    box-shadow: none;
    &:hover {
      border-color: ${({ theme }) => theme.colors?.neutral300 || "#c0c0cf"};
    }
    &--is-focused {
      border-color: ${({ theme }) => theme.colors?.primary600 || "#4945ff"};
      box-shadow: ${({ theme }) => theme.colors?.primary600 || "#4945ff"} 0px 0px 0px 2px;
    }
  }
  .react-select__multi-value {
    background-color: ${({ theme }) => theme.colors?.primary100 || "#f0f0ff"};
    border: 1px solid ${({ theme }) => theme.colors?.primary200 || "#d9d8ff"};
    border-radius: 4px;
    margin: 2px 4px 2px 0;
  }
  .react-select__multi-value__label {
    color: ${({ theme }) => theme.colors?.primary600 || "#4945ff"};
    font-size: 14px;
    padding: 2px 6px;
  }
  .react-select__multi-value__remove {
    color: ${({ theme }) => theme.colors?.primary600 || "#4945ff"};
    cursor: pointer;
    &:hover {
      background-color: ${({ theme }) => theme.colors?.primary200 || "#d9d8ff"};
      color: ${({ theme }) => theme.colors?.primary700 || "#271fe0"};
    }
  }
  .react-select__placeholder {
    color: ${({ theme }) => theme.colors?.neutral500 || "#8e8ea9"};
  }
  .react-select__menu {
    z-index: 5;
    border: 1px solid ${({ theme }) => theme.colors?.neutral200 || "#dcdce4"};
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .react-select__option {
    cursor: pointer;
    &--is-focused {
      background-color: ${({ theme }) => theme.colors?.primary100 || "#f0f0ff"};
    }
    &--is-selected {
      background-color: ${({ theme }) => theme.colors?.primary600 || "#4945ff"};
    }
  }
`;
const AddOptionRow = styled(T)`
  padding: 8px 0;
  gap: 8px;
`;
const OptionsManagerBox = styled(R)`
  margin-top: 4px;
  padding: 8px 12px;
  background: ${({ theme }) => theme.colors?.neutral100 || "#f6f6f9"};
  border-radius: 4px;
  border: 1px dashed ${({ theme }) => theme.colors?.neutral300 || "#c0c0cf"};
`;
const OptionTag = styled(T)`
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${({ theme }) => theme.colors?.neutral0 || "#ffffff"};
  border: 1px solid ${({ theme }) => theme.colors?.neutral200 || "#dcdce4"};
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
  color: ${({ theme }) => theme.colors?.danger600 || "#d02b20"};
  opacity: 0.6;
  &:hover {
    opacity: 1;
  }
`;
const DynamicEnumInput = ({
  name,
  attribute,
  label,
  hint,
  required,
  disabled,
  placeholder,
  intlLabel
}) => {
  const { formatMessage } = useIntl();
  const { onChange, value, error } = useField(name);
  const { get, post, del } = useFetchClient();
  const groupKey = attribute?.options?.groupKey || attribute?.customFieldConfig?.groupKey || name;
  const [availableOptions, setAvailableOptions] = useState([]);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await get(`/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}`);
      setAvailableOptions(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error("[dynamic-enum] Failed to fetch options:", err);
      setAvailableOptions([]);
    } finally {
      setLoading(false);
    }
  }, [get, groupKey]);
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);
  const selectedValues = useMemo(() => {
    let parsed;
    try {
      parsed = typeof value !== "string" ? value || [] : JSON.parse(value || "[]");
    } catch {
      parsed = [];
    }
    return Array.isArray(parsed) ? parsed : [];
  }, [value]);
  const selectOptions = useMemo(() => {
    return availableOptions.map((opt) => ({ label: opt, value: opt }));
  }, [availableOptions]);
  const selectedSelectValues = useMemo(() => {
    return selectedValues.map((val) => selectOptions.find((opt) => opt.value === val)).filter(Boolean);
  }, [selectedValues, selectOptions]);
  const handleChange = useCallback(
    (selected) => {
      const newValues = selected ? selected.map((s) => s.value) : [];
      onChange(name, JSON.stringify(newValues));
    },
    [onChange, name]
  );
  const handleAddOption = useCallback(async () => {
    const trimmed = newOptionValue.trim();
    if (!trimmed) return;
    try {
      const { data } = await post(`/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}`, {
        value: trimmed
      });
      setAvailableOptions(Array.isArray(data?.data) ? data.data : []);
      setNewOptionValue("");
    } catch (err) {
      console.error("[dynamic-enum] Failed to add option:", err);
    }
  }, [post, groupKey, newOptionValue]);
  const handleRemoveOption = useCallback(
    async (optionValue) => {
      try {
        const { data } = await del(
          `/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}/${encodeURIComponent(optionValue)}`
        );
        setAvailableOptions(Array.isArray(data?.data) ? data.data : []);
        const newSelected = selectedValues.filter((v) => v !== optionValue);
        if (newSelected.length !== selectedValues.length) {
          onChange(name, JSON.stringify(newSelected));
        }
      } catch (err) {
        console.error("[dynamic-enum] Failed to remove option:", err);
      }
    },
    [del, groupKey, selectedValues, onChange, name]
  );
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddOption();
      }
    },
    [handleAddOption]
  );
  const displayLabel = label || (intlLabel ? formatMessage(intlLabel) : name);
  return /* @__PURE__ */ jsx(Vm.Root, { hint, error, name, required, children: /* @__PURE__ */ jsxs(T, { direction: "column", alignItems: "stretch", gap: 1, children: [
    /* @__PURE__ */ jsx(Vm.Label, { children: displayLabel }),
    /* @__PURE__ */ jsx(
      StyledSelect,
      {
        isMulti: true,
        isSearchable: true,
        isDisabled: disabled,
        isLoading: loading,
        name,
        options: selectOptions,
        value: selectedSelectValues,
        onChange: handleChange,
        placeholder: placeholder || "Select...",
        classNamePrefix: "react-select",
        noOptionsMessage: () => "No options available. Click + to add new options."
      }
    ),
    !disabled && /* @__PURE__ */ jsxs(AddOptionRow, { alignItems: "center", children: [
      /* @__PURE__ */ jsx(R, { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
        X0,
        {
          "aria-label": "New option value",
          placeholder: "Type new option...",
          value: newOptionValue,
          onChange: (e) => setNewOptionValue(e.target.value),
          onKeyDown: handleKeyDown,
          size: "S"
        }
      ) }),
      /* @__PURE__ */ jsx(
        st,
        {
          onClick: handleAddOption,
          label: "Add option",
          disabled: !newOptionValue.trim(),
          variant: "secondary",
          size: "S",
          children: /* @__PURE__ */ jsx(sn, {})
        }
      ),
      /* @__PURE__ */ jsx(
        st,
        {
          onClick: () => setShowManager(!showManager),
          label: showManager ? "Hide options manager" : "Manage options",
          variant: "ghost",
          size: "S",
          children: /* @__PURE__ */ jsx(I, { variant: "pi", textColor: "neutral600", children: showManager ? "Hide" : `Manage (${availableOptions.length})` })
        }
      )
    ] }),
    showManager && !disabled && /* @__PURE__ */ jsxs(OptionsManagerBox, { children: [
      /* @__PURE__ */ jsxs(I, { variant: "sigma", textColor: "neutral600", style: { marginBottom: 8, display: "block" }, children: [
        "Available options for group: ",
        /* @__PURE__ */ jsx("strong", { children: groupKey })
      ] }),
      /* @__PURE__ */ jsxs(T, { wrap: "wrap", gap: 2, children: [
        availableOptions.length === 0 && /* @__PURE__ */ jsx(I, { variant: "pi", textColor: "neutral500", children: "No options yet. Add one above." }),
        availableOptions.map((opt) => /* @__PURE__ */ jsxs(OptionTag, { children: [
          /* @__PURE__ */ jsx("span", { children: opt }),
          /* @__PURE__ */ jsx(
            RemoveButton,
            {
              type: "button",
              onClick: () => handleRemoveOption(opt),
              title: `Remove "${opt}"`,
              children: /* @__PURE__ */ jsx(C5, { width: 10, height: 10 })
            }
          )
        ] }, opt))
      ] })
    ] }),
    /* @__PURE__ */ jsx(Vm.Hint, {}),
    /* @__PURE__ */ jsx(Vm.Error, {})
  ] }) });
};
export {
  DynamicEnumInput as default
};
