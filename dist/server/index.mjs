const register = ({ strapi }) => {
  strapi.customFields.register({
    name: "dynamic-enum",
    plugin: "dynamic-enum",
    type: "string",
    inputSize: {
      default: 12,
      isResizable: true
    }
  });
};
const STORE_KEY_PREFIX$1 = "dynamic_enum_options_";
const bootstrap = async ({ strapi }) => {
  const fieldMap = /* @__PURE__ */ new Map();
  const components = strapi.components || {};
  for (const [uid, component] of Object.entries(components)) {
    if (!component?.attributes) continue;
    for (const [attrName, attr] of Object.entries(component.attributes)) {
      if (attr.type !== "enumeration" || !Array.isArray(attr.enum)) continue;
      await mergeEnumOptions(strapi, attr, `${uid}::${attrName}`);
      if (!fieldMap.has(attrName)) fieldMap.set(attrName, []);
      fieldMap.get(attrName).push({ attributes: component.attributes, attrName, uid });
    }
  }
  const contentTypes = strapi.contentTypes || {};
  for (const [uid, ct] of Object.entries(contentTypes)) {
    if (!ct?.attributes) continue;
    for (const [attrName, attr] of Object.entries(ct.attributes)) {
      if (attr.type !== "enumeration" || !Array.isArray(attr.enum)) continue;
      await mergeEnumOptions(strapi, attr, `${uid}::${attrName}`);
      if (!fieldMap.has(attrName)) fieldMap.set(attrName, []);
      fieldMap.get(attrName).push({ attributes: ct.attributes, attrName, uid });
    }
  }
  for (const [fieldName, targets] of fieldMap.entries()) {
    const stored = await getStoredOptions$1(strapi, fieldName);
    if (!stored || stored.length === 0) continue;
    for (const { attributes, attrName } of targets) {
      const attr = attributes[attrName];
      const enumSet = new Set(attr.enum);
      for (const val of stored) {
        if (!enumSet.has(val)) {
          attr.enum.push(val);
          enumSet.add(val);
        }
      }
    }
    strapi.log.debug(`[dynamic-enum] plain key "${fieldName}": merged into ${targets.length} schema(s)`);
  }
  strapi.log.info("[dynamic-enum] Bootstrap: merged dynamic enum options into schemas");
};
async function getStoredOptions$1(strapi, groupKey) {
  try {
    const stored = await strapi.store.get({
      type: "plugin",
      name: "dynamic-enum",
      key: `${STORE_KEY_PREFIX$1}${groupKey}`
    });
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}
async function mergeEnumOptions(strapi, attr, groupKey) {
  const stored = await getStoredOptions$1(strapi, groupKey);
  if (stored.length === 0) return;
  const currentEnum = attr.enum;
  const enumSet = new Set(currentEnum);
  let added = 0;
  for (const val of stored) {
    if (!enumSet.has(val)) {
      currentEnum.push(val);
      enumSet.add(val);
      added++;
    }
  }
  if (added > 0) {
    strapi.log.debug(`[dynamic-enum] ${groupKey}: added ${added} dynamic values`);
  }
}
const STORE_KEY_PREFIX = "dynamic_enum_options_";
function getStoreKey(groupKey) {
  return `${STORE_KEY_PREFIX}${groupKey}`;
}
async function getStoredOptions(strapi, groupKey) {
  const stored = await strapi.store.get({
    type: "plugin",
    name: "dynamic-enum",
    key: getStoreKey(groupKey)
  });
  return Array.isArray(stored) ? stored : [];
}
async function setStoredOptions(strapi, groupKey, options) {
  await strapi.store.set({
    type: "plugin",
    name: "dynamic-enum",
    key: getStoreKey(groupKey),
    value: options
  });
}
const controller = ({ strapi }) => ({
  async getOptions(ctx) {
    const { groupKey } = ctx.params;
    if (!groupKey) return ctx.badRequest("groupKey is required");
    const options = await getStoredOptions(strapi, groupKey);
    ctx.body = { data: options };
  },
  async addOption(ctx) {
    const { groupKey } = ctx.params;
    const { value } = ctx.request.body;
    if (!groupKey) return ctx.badRequest("groupKey is required");
    if (!value || typeof value !== "string" || !value.trim()) {
      return ctx.badRequest("value is required and must be a non-empty string");
    }
    const trimmedValue = value.trim();
    const options = await getStoredOptions(strapi, groupKey);
    if (options.includes(trimmedValue)) {
      return ctx.badRequest(`Option "${trimmedValue}" already exists`);
    }
    options.push(trimmedValue);
    await setStoredOptions(strapi, groupKey, options);
    mergeValueIntoSchema(strapi, groupKey, trimmedValue);
    ctx.body = { data: options };
  },
  async removeOption(ctx) {
    const { groupKey, value } = ctx.params;
    if (!groupKey || !value) return ctx.badRequest("groupKey and value are required");
    const decodedValue = decodeURIComponent(value);
    const options = await getStoredOptions(strapi, groupKey);
    const filtered = options.filter((opt) => opt !== decodedValue);
    await setStoredOptions(strapi, groupKey, filtered);
    removeValueFromSchema(strapi, groupKey, decodedValue);
    ctx.body = { data: filtered };
  },
  async reorderOptions(ctx) {
    const { groupKey } = ctx.params;
    const { options } = ctx.request.body;
    if (!groupKey) return ctx.badRequest("groupKey is required");
    if (!Array.isArray(options)) return ctx.badRequest("options must be an array");
    await setStoredOptions(strapi, groupKey, options);
    ctx.body = { data: options };
  }
});
function resolveAllSchemaAttributes(strapi, groupKey) {
  const sepIdx = groupKey.lastIndexOf("::");
  if (sepIdx !== -1) {
    const uid = groupKey.substring(0, sepIdx);
    const fieldName2 = groupKey.substring(sepIdx + 2);
    const schema = strapi.components?.[uid] || strapi.contentTypes?.[uid];
    const attr = schema?.attributes?.[fieldName2];
    return attr?.type === "enumeration" && Array.isArray(attr.enum) ? [attr] : [];
  }
  const fieldName = groupKey;
  const results = [];
  for (const component of Object.values(strapi.components || {})) {
    const attr = component?.attributes?.[fieldName];
    if (attr?.type === "enumeration" && Array.isArray(attr.enum)) {
      results.push(attr);
    }
  }
  for (const ct of Object.values(strapi.contentTypes || {})) {
    const attr = ct?.attributes?.[fieldName];
    if (attr?.type === "enumeration" && Array.isArray(attr.enum)) {
      results.push(attr);
    }
  }
  return results;
}
function mergeValueIntoSchema(strapi, groupKey, value) {
  const attrs = resolveAllSchemaAttributes(strapi, groupKey);
  for (const attr of attrs) {
    if (!attr.enum.includes(value)) {
      attr.enum.push(value);
    }
  }
}
function removeValueFromSchema(strapi, groupKey, value) {
  const attrs = resolveAllSchemaAttributes(strapi, groupKey);
  for (const attr of attrs) {
    const idx = attr.enum.indexOf(value);
    if (idx !== -1) {
      attr.enum.splice(idx, 1);
    }
  }
}
const admin = {
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/options/:groupKey",
      handler: "dynamic-enum.getOptions",
      config: {
        policies: []
      }
    },
    {
      method: "POST",
      path: "/options/:groupKey",
      handler: "dynamic-enum.addOption",
      config: {
        policies: []
      }
    },
    {
      method: "DELETE",
      path: "/options/:groupKey/:value",
      handler: "dynamic-enum.removeOption",
      config: {
        policies: []
      }
    },
    {
      method: "PUT",
      path: "/options/:groupKey/reorder",
      handler: "dynamic-enum.reorderOptions",
      config: {
        policies: []
      }
    }
  ]
};
const routes = {
  admin
};
const index = {
  register,
  bootstrap,
  controllers: {
    "dynamic-enum": controller
  },
  routes
};
export {
  index as default
};
