"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const m = require("react");
const reactIntl = require("react-intl");
const index = require("./index-WTdSarmv.js");
const admin = require("@strapi/strapi/admin");
const Select = require("react-select");
const styled = require("styled-components");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Select__default = /* @__PURE__ */ _interopDefault(Select);
const styled__default = /* @__PURE__ */ _interopDefault(styled);
const PLUGIN_ID = "dynamic-enum";
const StyledSelect = styled__default.default(Select__default.default)`
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
const AddOptionRow = styled__default.default(index.T)`
  padding: 8px 0;
  gap: 8px;
`;
const OptionsManagerBox = styled__default.default(index.R)`
  margin-top: 4px;
  padding: 8px 12px;
  background: ${({ theme }) => theme.colors?.neutral100 || "#f6f6f9"};
  border-radius: 4px;
  border: 1px dashed ${({ theme }) => theme.colors?.neutral300 || "#c0c0cf"};
`;
const OptionTag = styled__default.default(index.T)`
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${({ theme }) => theme.colors?.neutral0 || "#ffffff"};
  border: 1px solid ${({ theme }) => theme.colors?.neutral200 || "#dcdce4"};
  border-radius: 4px;
  font-size: 13px;
`;
const RemoveButton = styled__default.default.button`
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
  const { formatMessage } = reactIntl.useIntl();
  const { onChange, value, error } = admin.useField(name);
  const { get, post, del } = admin.useFetchClient();
  const groupKey = attribute?.options?.groupKey || attribute?.customFieldConfig?.groupKey || name;
  const [availableOptions, setAvailableOptions] = m.useState([]);
  const [newOptionValue, setNewOptionValue] = m.useState("");
  const [loading, setLoading] = m.useState(false);
  const [showManager, setShowManager] = m.useState(false);
  const fetchOptions = m.useCallback(async () => {
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
  m.useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);
  const selectedValues = m.useMemo(() => {
    let parsed;
    try {
      parsed = typeof value !== "string" ? value || [] : JSON.parse(value || "[]");
    } catch {
      parsed = [];
    }
    return Array.isArray(parsed) ? parsed : [];
  }, [value]);
  const selectOptions = m.useMemo(() => {
    return availableOptions.map((opt) => ({ label: opt, value: opt }));
  }, [availableOptions]);
  const selectedSelectValues = m.useMemo(() => {
    return selectedValues.map((val) => selectOptions.find((opt) => opt.value === val)).filter(Boolean);
  }, [selectedValues, selectOptions]);
  const handleChange = m.useCallback(
    (selected) => {
      const newValues = selected ? selected.map((s) => s.value) : [];
      onChange(name, JSON.stringify(newValues));
    },
    [onChange, name]
  );
  const handleAddOption = m.useCallback(async () => {
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
  const handleRemoveOption = m.useCallback(
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
  const handleKeyDown = m.useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddOption();
      }
    },
    [handleAddOption]
  );
  const displayLabel = label || (intlLabel ? formatMessage(intlLabel) : name);
  return /* @__PURE__ */ jsxRuntime.jsx(index.Vm.Root, { hint, error, name, required, children: /* @__PURE__ */ jsxRuntime.jsxs(index.T, { direction: "column", alignItems: "stretch", gap: 1, children: [
    /* @__PURE__ */ jsxRuntime.jsx(index.Vm.Label, { children: displayLabel }),
    /* @__PURE__ */ jsxRuntime.jsx(
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
    !disabled && /* @__PURE__ */ jsxRuntime.jsxs(AddOptionRow, { alignItems: "center", children: [
      /* @__PURE__ */ jsxRuntime.jsx(index.R, { style: { flex: 1 }, children: /* @__PURE__ */ jsxRuntime.jsx(
        index.X0,
        {
          "aria-label": "New option value",
          placeholder: "Type new option...",
          value: newOptionValue,
          onChange: (e) => setNewOptionValue(e.target.value),
          onKeyDown: handleKeyDown,
          size: "S"
        }
      ) }),
      /* @__PURE__ */ jsxRuntime.jsx(
        index.st,
        {
          onClick: handleAddOption,
          label: "Add option",
          disabled: !newOptionValue.trim(),
          variant: "secondary",
          size: "S",
          children: /* @__PURE__ */ jsxRuntime.jsx(index.sn, {})
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        index.st,
        {
          onClick: () => setShowManager(!showManager),
          label: showManager ? "Hide options manager" : "Manage options",
          variant: "ghost",
          size: "S",
          children: /* @__PURE__ */ jsxRuntime.jsx(index.I, { variant: "pi", textColor: "neutral600", children: showManager ? "Hide" : `Manage (${availableOptions.length})` })
        }
      )
    ] }),
    showManager && !disabled && /* @__PURE__ */ jsxRuntime.jsxs(OptionsManagerBox, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs(index.I, { variant: "sigma", textColor: "neutral600", style: { marginBottom: 8, display: "block" }, children: [
        "Available options for group: ",
        /* @__PURE__ */ jsxRuntime.jsx("strong", { children: groupKey })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(index.T, { wrap: "wrap", gap: 2, children: [
        availableOptions.length === 0 && /* @__PURE__ */ jsxRuntime.jsx(index.I, { variant: "pi", textColor: "neutral500", children: "No options yet. Add one above." }),
        availableOptions.map((opt) => /* @__PURE__ */ jsxRuntime.jsxs(OptionTag, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: opt }),
          /* @__PURE__ */ jsxRuntime.jsx(
            RemoveButton,
            {
              type: "button",
              onClick: () => handleRemoveOption(opt),
              title: `Remove "${opt}"`,
              children: /* @__PURE__ */ jsxRuntime.jsx(index.C5, { width: 10, height: 10 })
            }
          )
        ] }, opt))
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(index.Vm.Hint, {}),
    /* @__PURE__ */ jsxRuntime.jsx(index.Vm.Error, {})
  ] }) });
};
exports.default = DynamicEnumInput;
