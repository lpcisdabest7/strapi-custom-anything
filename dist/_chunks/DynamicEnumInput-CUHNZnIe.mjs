import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useIntl } from "react-intl";
import { V as Vm, T, s as sn, C as C5 } from "./index-l0TPQFa3.mjs";
import { useField, useFetchClient } from "@strapi/strapi/admin";
import Select from "react-select";
import styled from "styled-components";
const PLUGIN_ID = "dynamic-enum";
function extractGroupKey(name) {
  const parts = name.split(".");
  const nonNumeric = parts.filter((p) => isNaN(Number(p)));
  return nonNumeric.join("_") || name;
}
const StyledSelectWrapper = styled.div`
  .de-react-select__control {
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    border-radius: 4px;
    min-height: 40px;
    background: ${({ theme }) => theme.colors.neutral0};
    box-shadow: none;
    cursor: pointer;
  }
  .de-react-select__control:hover {
    border-color: ${({ theme }) => theme.colors.neutral300};
  }
  .de-react-select__control--is-focused {
    border-color: ${({ theme }) => theme.colors.primary600};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary600}40;
  }
  .de-react-select__single-value {
    color: ${({ theme }) => theme.colors.neutral800};
    font-size: 14px;
  }
  .de-react-select__input-container {
    color: ${({ theme }) => theme.colors.neutral800};
  }
  .de-react-select__placeholder {
    color: ${({ theme }) => theme.colors.neutral500};
  }
  .de-react-select__menu {
    z-index: 5;
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    border-radius: 4px;
    background: ${({ theme }) => theme.colors.neutral0};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .de-react-select__option {
    cursor: pointer;
    color: ${({ theme }) => theme.colors.neutral800};
    background: ${({ theme }) => theme.colors.neutral0};
  }
  .de-react-select__option--is-focused {
    background-color: ${({ theme }) => theme.colors.primary100};
  }
  .de-react-select__option--is-selected {
    background-color: ${({ theme }) => theme.colors.primary600};
    color: #fff;
  }
  .de-react-select__indicator-separator {
    background-color: ${({ theme }) => theme.colors.neutral200};
  }
  .de-react-select__dropdown-indicator,
  .de-react-select__clear-indicator {
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
  const groupKey = extractGroupKey(name);
  const [dbOptions, setDbOptions] = useState([]);
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const schemaOptions = useMemo(() => {
    const opts = attribute?.options || attribute?.enum || [];
    return opts.map((opt) => {
      if (typeof opt === "string") {
        const [lbl, val] = [...opt.split(/:(.*)/s), opt];
        return lbl && val ? { label: lbl, value: val } : null;
      }
      return null;
    }).filter(Boolean);
  }, [attribute]);
  const fetchDbOptions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await get(
        `/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}`
      );
      setDbOptions(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setDbOptions([]);
    } finally {
      setLoading(false);
    }
  }, [get, groupKey]);
  useEffect(() => {
    fetchDbOptions();
  }, [fetchDbOptions]);
  const allOptions = useMemo(() => {
    const merged = /* @__PURE__ */ new Map();
    schemaOptions.forEach((o) => merged.set(o.value, o));
    dbOptions.forEach((val) => {
      if (!merged.has(val)) {
        merged.set(val, { label: val, value: val });
      }
    });
    return Array.from(merged.values());
  }, [schemaOptions, dbOptions]);
  const selectedOption = useMemo(() => {
    if (!value) return null;
    return allOptions.find((o) => o.value === value) || { label: value, value };
  }, [value, allOptions]);
  const handleChange = useCallback(
    (selected) => {
      onChange(name, selected ? selected.value : null);
    },
    [onChange, name]
  );
  const handleAddOption = useCallback(async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    try {
      const { data } = await post(
        `/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}`,
        { value: trimmed }
      );
      setDbOptions(Array.isArray(data?.data) ? data.data : []);
      setNewValue("");
    } catch (err) {
      console.error("[dynamic-enum] add failed:", err);
    }
  }, [post, groupKey, newValue]);
  const handleRemoveDbOption = useCallback(
    async (optVal) => {
      try {
        const { data } = await del(
          `/${PLUGIN_ID}/options/${encodeURIComponent(groupKey)}/${encodeURIComponent(optVal)}`
        );
        setDbOptions(Array.isArray(data?.data) ? data.data : []);
        if (value === optVal) {
          onChange(name, null);
        }
      } catch (err) {
        console.error("[dynamic-enum] remove failed:", err);
      }
    },
    [del, groupKey, value, onChange, name]
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
    /* @__PURE__ */ jsx(StyledSelectWrapper, { children: /* @__PURE__ */ jsx(
      Select,
      {
        isClearable: true,
        isSearchable: true,
        isDisabled: disabled,
        isLoading: loading,
        name,
        options: allOptions,
        value: selectedOption,
        onChange: handleChange,
        placeholder: placeholder || "Select...",
        classNamePrefix: "de-react-select",
        noOptionsMessage: () => "No options. Add one below."
      }
    ) }),
    !disabled && /* @__PURE__ */ jsxs(AddRow, { children: [
      /* @__PURE__ */ jsx(
        AddInput,
        {
          placeholder: "New option...",
          value: newValue,
          onChange: (e) => setNewValue(e.target.value),
          onKeyDown: handleKeyDown
        }
      ),
      /* @__PURE__ */ jsx(
        AddBtn,
        {
          onClick: handleAddOption,
          disabled: !newValue.trim(),
          title: "Add option",
          children: /* @__PURE__ */ jsx(sn, { width: 16, height: 16 })
        }
      ),
      /* @__PURE__ */ jsx(ManageBtn, { onClick: () => setShowManager(!showManager), children: showManager ? "Hide" : `Manage (${allOptions.length})` })
    ] }),
    showManager && !disabled && /* @__PURE__ */ jsxs(ManagerBox, { children: [
      /* @__PURE__ */ jsxs(ManagerInfo, { children: [
        "Group: ",
        /* @__PURE__ */ jsx("strong", { children: groupKey }),
        " —",
        " ",
        /* @__PURE__ */ jsx(ManagerHint, { children: "Schema options (gray) are read-only. Dynamic options can be removed." })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexWrap: "wrap" }, children: [
        schemaOptions.filter((o) => !dbOptions.includes(o.value)).map((o) => /* @__PURE__ */ jsx(SchemaChip, { title: "Defined in schema (read-only)", children: o.label }, `schema-${o.value}`)),
        dbOptions.map((val) => /* @__PURE__ */ jsxs(OptionChip, { children: [
          val,
          /* @__PURE__ */ jsx(
            RemoveBtn,
            {
              onClick: () => handleRemoveDbOption(val),
              title: `Remove "${val}"`,
              children: /* @__PURE__ */ jsx(C5, { width: 10, height: 10 })
            }
          )
        ] }, `db-${val}`)),
        allOptions.length === 0 && /* @__PURE__ */ jsx(EmptyText, { children: "No options yet." })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Vm.Hint, {}),
    /* @__PURE__ */ jsx(Vm.Error, {})
  ] }) });
};
export {
  DynamicEnumInput as default
};
