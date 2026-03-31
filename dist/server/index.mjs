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
  try {
    const { createRequire } = require("module");
    const coreRequire = createRequire(
      require.resolve("@strapi/core/package.json")
    );
    const validatorsModule = coreRequire("./dist/services/entity-validator/validators");
    const yup = require("@strapi/utils").yup;
    if (validatorsModule?.Validators) {
      const originalEnumValidator = validatorsModule.Validators.enumeration;
      validatorsModule.Validators.enumeration = ({ attr }) => {
        return yup.string().nullable();
      };
      validatorsModule.enumerationValidator = validatorsModule.Validators.enumeration;
      strapi.log.info("[dynamic-enum] Patched enumeration validator to accept dynamic options");
    }
  } catch (err) {
    strapi.log.warn(`[dynamic-enum] Failed to patch enumeration validator: ${err}`);
  }
};
const STORE_KEY_PREFIX$1 = "plugin_dynamic-enum_dynamic_enum_options_";
const bootstrap = async ({ strapi }) => {
  const knex = strapi.db?.connection || strapi.db?.knex;
  if (!knex) {
    strapi.log.warn("[dynamic-enum] Cannot access database connection for bootstrap");
    return;
  }
  const enumFieldMap = /* @__PURE__ */ new Map();
  for (const component of Object.values(strapi.components || {})) {
    if (!component?.attributes) continue;
    for (const [attrName, attr] of Object.entries(component.attributes)) {
      if (attr.type === "enumeration" && Array.isArray(attr.enum)) {
        if (!enumFieldMap.has(attrName)) enumFieldMap.set(attrName, []);
        enumFieldMap.get(attrName).push(attr);
      }
    }
  }
  for (const ct of Object.values(strapi.contentTypes || {})) {
    if (!ct?.attributes) continue;
    for (const [attrName, attr] of Object.entries(ct.attributes)) {
      if (attr.type === "enumeration" && Array.isArray(attr.enum)) {
        if (!enumFieldMap.has(attrName)) enumFieldMap.set(attrName, []);
        enumFieldMap.get(attrName).push(attr);
      }
    }
  }
  let allRows = [];
  try {
    allRows = await knex("strapi_core_store_settings").where("key", "like", `${STORE_KEY_PREFIX$1}%`).select("key", "value");
  } catch (err) {
    strapi.log.warn(`[dynamic-enum] Failed to query core_store: ${err}`);
    return;
  }
  const dynamicByField = /* @__PURE__ */ new Map();
  for (const row of allRows) {
    const groupKey = row.key.replace(STORE_KEY_PREFIX$1, "");
    const fieldName = extractFieldName$1(groupKey);
    let values = [];
    try {
      const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      values = Array.isArray(parsed) ? parsed : [];
    } catch {
      continue;
    }
    if (!dynamicByField.has(fieldName)) dynamicByField.set(fieldName, /* @__PURE__ */ new Set());
    values.forEach((v) => dynamicByField.get(fieldName).add(v));
  }
  const originalSchemaEnums = /* @__PURE__ */ new Map();
  for (const [fieldName, attrs] of enumFieldMap.entries()) {
    const original = /* @__PURE__ */ new Set();
    for (const attr of attrs) {
      attr.enum.forEach((v) => original.add(v));
    }
    originalSchemaEnums.set(fieldName, original);
  }
  let totalAdded = 0;
  for (const [fieldName, dynamicValues] of dynamicByField.entries()) {
    const attrs = enumFieldMap.get(fieldName);
    if (!attrs || attrs.length === 0) continue;
    for (const attr of attrs) {
      const enumSet = new Set(attr.enum);
      for (const val of dynamicValues) {
        if (!enumSet.has(val)) {
          attr.enum.push(val);
          enumSet.add(val);
          totalAdded++;
        }
      }
    }
  }
  const allDynamic = /* @__PURE__ */ new Set();
  for (const vals of dynamicByField.values()) {
    vals.forEach((v) => allDynamic.add(v));
  }
  strapi.__dynamicEnumCache = allDynamic;
  strapi.__originalSchemaEnums = originalSchemaEnums;
  strapi.log.info(`[dynamic-enum] Bootstrap: merged ${totalAdded} dynamic enum values into schemas`);
};
function extractFieldName$1(groupKey) {
  const sepIdx = groupKey.lastIndexOf("::");
  if (sepIdx !== -1) return groupKey.substring(sepIdx + 2);
  const dotIdx = groupKey.lastIndexOf(".");
  if (dotIdx !== -1) return groupKey.substring(dotIdx + 1);
  const underscoreIdx = groupKey.lastIndexOf("_");
  if (underscoreIdx !== -1) return groupKey.substring(underscoreIdx + 1);
  return groupKey;
}
const STORE_KEY_PREFIX = "dynamic_enum_options_";
const DB_KEY_PREFIX = "plugin_dynamic-enum_dynamic_enum_options_";
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
async function findAllRelatedKeys(strapi, groupKey) {
  const fieldName = extractFieldName(groupKey);
  const knex = strapi.db?.connection || strapi.db?.knex;
  if (!knex) return [];
  try {
    const rows = await knex("strapi_core_store_settings").where("key", "like", `${DB_KEY_PREFIX}%${fieldName}`).select("key", "value");
    return rows;
  } catch {
    return [];
  }
}
async function getAllRelatedOptions(strapi, groupKey) {
  const rows = await findAllRelatedKeys(strapi, groupKey);
  const merged = /* @__PURE__ */ new Set();
  for (const row of rows) {
    try {
      const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      if (Array.isArray(parsed)) {
        parsed.forEach((v) => merged.add(v));
      }
    } catch {
    }
  }
  return Array.from(merged);
}
async function removeFromAllRelatedKeys(strapi, groupKey, value) {
  const rows = await findAllRelatedKeys(strapi, groupKey);
  for (const row of rows) {
    try {
      const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      if (Array.isArray(parsed) && parsed.includes(value)) {
        const filtered = parsed.filter((v) => v !== value);
        const gk = row.key.substring(DB_KEY_PREFIX.length);
        await setStoredOptions(strapi, gk, filtered);
      }
    } catch {
    }
  }
}
function extractFieldName(groupKey) {
  const sepIdx = groupKey.lastIndexOf("::");
  if (sepIdx !== -1) return groupKey.substring(sepIdx + 2);
  const dotIdx = groupKey.lastIndexOf(".");
  if (dotIdx !== -1) return groupKey.substring(dotIdx + 1);
  const underscoreIdx = groupKey.lastIndexOf("_");
  if (underscoreIdx !== -1) return groupKey.substring(underscoreIdx + 1);
  return groupKey;
}
function addToCache(strapi, groupKey, value) {
  const cache = strapi.__dynamicEnumCache || /* @__PURE__ */ new Set();
  cache.add(value);
  strapi.__dynamicEnumCache = cache;
  const fieldName = extractFieldName(groupKey);
  const allSchemas = [
    ...Object.values(strapi.components || {}),
    ...Object.values(strapi.contentTypes || {})
  ];
  for (const schema of allSchemas) {
    const attr = schema?.attributes?.[fieldName];
    if (attr?.type === "enumeration" && Array.isArray(attr.enum) && !attr.enum.includes(value)) {
      attr.enum.push(value);
    }
  }
}
async function removeFromCache(strapi, groupKey, value) {
  const remaining = await getAllRelatedOptions(strapi, groupKey);
  if (!remaining.includes(value)) {
    const cache = strapi.__dynamicEnumCache || /* @__PURE__ */ new Set();
    cache.delete(value);
  }
}
const controller = ({ strapi }) => ({
  /**
   * GET: return all DB-stored dynamic options for this groupKey.
   */
  async getOptions(ctx) {
    const { groupKey } = ctx.params;
    if (!groupKey) return ctx.badRequest("groupKey is required");
    const allOptions = await getAllRelatedOptions(strapi, groupKey);
    ctx.body = { data: allOptions };
  },
  async addOption(ctx) {
    const { groupKey } = ctx.params;
    const { value } = ctx.request.body;
    if (!groupKey) return ctx.badRequest("groupKey is required");
    if (!value || typeof value !== "string" || !value.trim()) {
      return ctx.badRequest("value is required and must be a non-empty string");
    }
    const trimmedValue = value.trim();
    const allOptions = await getAllRelatedOptions(strapi, groupKey);
    if (allOptions.includes(trimmedValue)) {
      return ctx.badRequest(`Option "${trimmedValue}" already exists`);
    }
    const options = await getStoredOptions(strapi, groupKey);
    options.push(trimmedValue);
    await setStoredOptions(strapi, groupKey, options);
    addToCache(strapi, groupKey, trimmedValue);
    const updatedAll = await getAllRelatedOptions(strapi, groupKey);
    ctx.body = { data: updatedAll };
  },
  /**
   * DELETE: remove option from ALL related groupKeys in DB.
   */
  async removeOption(ctx) {
    const { groupKey, value } = ctx.params;
    if (!groupKey || !value) return ctx.badRequest("groupKey and value are required");
    const decodedValue = decodeURIComponent(value);
    await removeFromAllRelatedKeys(strapi, groupKey, decodedValue);
    await removeFromCache(strapi, groupKey, decodedValue);
    const updatedAll = await getAllRelatedOptions(strapi, groupKey);
    ctx.body = { data: updatedAll };
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
const admin = {
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/options/:groupKey",
      handler: "dynamic-enum.getOptions",
      config: { auth: false, policies: [] }
    },
    {
      method: "POST",
      path: "/options/:groupKey",
      handler: "dynamic-enum.addOption",
      config: { auth: false, policies: [] }
    },
    {
      method: "DELETE",
      path: "/options/:groupKey/:value",
      handler: "dynamic-enum.removeOption",
      config: { auth: false, policies: [] }
    },
    {
      method: "PUT",
      path: "/options/:groupKey/reorder",
      handler: "dynamic-enum.reorderOptions",
      config: { auth: false, policies: [] }
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
