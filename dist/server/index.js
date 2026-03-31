"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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
const bootstrap = async ({ strapi }) => {
  const knex = strapi.db?.connection || strapi.db?.knex;
  if (!knex) {
    strapi.log.warn("[dynamic-enum] Cannot access database connection for bootstrap");
    return;
  }
  const STORE_KEY_PREFIX2 = "plugin_dynamic-enum_dynamic_enum_options_";
  let allRows = [];
  try {
    allRows = await knex("strapi_core_store_settings").where("key", "like", `${STORE_KEY_PREFIX2}%`).select("key", "value");
  } catch (err) {
    strapi.log.warn(`[dynamic-enum] Failed to query core_store: ${err}`);
    return;
  }
  const allDynamic = /* @__PURE__ */ new Set();
  let totalOptions = 0;
  for (const row of allRows) {
    try {
      const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      if (Array.isArray(parsed)) {
        parsed.forEach((v) => allDynamic.add(v));
        totalOptions += parsed.length;
      }
    } catch {
      continue;
    }
  }
  strapi.__dynamicEnumCache = allDynamic;
  strapi.log.info(`[dynamic-enum] Bootstrap: loaded ${totalOptions} dynamic options into cache (no schema mutation)`);
};
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
    ctx.body = { data: options };
  },
  async removeOption(ctx) {
    const { groupKey, value } = ctx.params;
    if (!groupKey || !value) return ctx.badRequest("groupKey and value are required");
    const decodedValue = decodeURIComponent(value);
    const options = await getStoredOptions(strapi, groupKey);
    const filtered = options.filter((v) => v !== decodedValue);
    await setStoredOptions(strapi, groupKey, filtered);
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
module.exports = index;
