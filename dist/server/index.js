"use strict";
const register = ({ strapi }) => {
  strapi.customFields.register({
    name: "dynamic-enum",
    plugin: "dynamic-enum",
    type: "json",
    inputSize: {
      default: 12,
      isResizable: true
    }
  });
};
const STORE_KEY_PREFIX = "plugin_dynamic_enum_options_";
function getStoreKey(groupKey) {
  return `${STORE_KEY_PREFIX}${groupKey}`;
}
const controller = ({ strapi }) => ({
  /**
   * GET /dynamic-enum/options/:groupKey
   * Returns the list of options for a given group
   */
  async getOptions(ctx) {
    const { groupKey } = ctx.params;
    if (!groupKey) {
      return ctx.badRequest("groupKey is required");
    }
    const stored = await strapi.store.get({ key: getStoreKey(groupKey) });
    const options = Array.isArray(stored) ? stored : [];
    ctx.body = { data: options };
  },
  /**
   * POST /dynamic-enum/options/:groupKey
   * Add a new option value to the group
   * Body: { value: string }
   */
  async addOption(ctx) {
    const { groupKey } = ctx.params;
    const { value } = ctx.request.body;
    if (!groupKey) {
      return ctx.badRequest("groupKey is required");
    }
    if (!value || typeof value !== "string" || !value.trim()) {
      return ctx.badRequest("value is required and must be a non-empty string");
    }
    const trimmedValue = value.trim();
    const stored = await strapi.store.get({ key: getStoreKey(groupKey) });
    const options = Array.isArray(stored) ? stored : [];
    if (options.includes(trimmedValue)) {
      return ctx.badRequest(`Option "${trimmedValue}" already exists`);
    }
    options.push(trimmedValue);
    await strapi.store.set({ key: getStoreKey(groupKey), value: options });
    ctx.body = { data: options };
  },
  /**
   * DELETE /dynamic-enum/options/:groupKey/:value
   * Remove an option from the group
   */
  async removeOption(ctx) {
    const { groupKey, value } = ctx.params;
    if (!groupKey || !value) {
      return ctx.badRequest("groupKey and value are required");
    }
    const decodedValue = decodeURIComponent(value);
    const stored = await strapi.store.get({ key: getStoreKey(groupKey) });
    const options = Array.isArray(stored) ? stored : [];
    const filtered = options.filter((opt) => opt !== decodedValue);
    await strapi.store.set({ key: getStoreKey(groupKey), value: filtered });
    ctx.body = { data: filtered };
  },
  /**
   * PUT /dynamic-enum/options/:groupKey/reorder
   * Reorder options for a group
   * Body: { options: string[] }
   */
  async reorderOptions(ctx) {
    const { groupKey } = ctx.params;
    const { options } = ctx.request.body;
    if (!groupKey) {
      return ctx.badRequest("groupKey is required");
    }
    if (!Array.isArray(options)) {
      return ctx.badRequest("options must be an array");
    }
    await strapi.store.set({ key: getStoreKey(groupKey), value: options });
    ctx.body = { data: options };
  }
});
const routes = [
  {
    method: "GET",
    path: "/options/:groupKey",
    handler: "dynamic-enum.getOptions",
    config: {
      policies: ["admin::isAuthenticatedAdmin"]
    }
  },
  {
    method: "POST",
    path: "/options/:groupKey",
    handler: "dynamic-enum.addOption",
    config: {
      policies: ["admin::isAuthenticatedAdmin"]
    }
  },
  {
    method: "DELETE",
    path: "/options/:groupKey/:value",
    handler: "dynamic-enum.removeOption",
    config: {
      policies: ["admin::isAuthenticatedAdmin"]
    }
  },
  {
    method: "PUT",
    path: "/options/:groupKey/reorder",
    handler: "dynamic-enum.reorderOptions",
    config: {
      policies: ["admin::isAuthenticatedAdmin"]
    }
  }
];
const index = {
  register,
  controllers: {
    "dynamic-enum": controller
  },
  routes
};
module.exports = index;
