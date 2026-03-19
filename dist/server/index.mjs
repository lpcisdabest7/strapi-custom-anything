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
    const filtered = options.filter((opt) => opt !== decodedValue);
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
const admin = [
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
const routes = {
  admin
};
const index = {
  register,
  controllers: {
    "dynamic-enum": controller
  },
  routes
};
export {
  index as default
};
