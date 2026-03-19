import type { Core } from '@strapi/strapi';

const STORE_KEY_PREFIX = 'dynamic_enum_options_';

function getStoreKey(groupKey: string) {
  return `${STORE_KEY_PREFIX}${groupKey}`;
}

async function getStoredOptions(strapi: Core.Strapi, groupKey: string): Promise<string[]> {
  const stored = await strapi.store.get({
    type: 'plugin',
    name: 'dynamic-enum',
    key: getStoreKey(groupKey),
  });
  return Array.isArray(stored) ? stored : [];
}

async function setStoredOptions(strapi: Core.Strapi, groupKey: string, options: string[]) {
  await strapi.store.set({
    type: 'plugin',
    name: 'dynamic-enum',
    key: getStoreKey(groupKey),
    value: options,
  });
}

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getOptions(ctx: any) {
    const { groupKey } = ctx.params;
    if (!groupKey) return ctx.badRequest('groupKey is required');

    const options = await getStoredOptions(strapi, groupKey);
    ctx.body = { data: options };
  },

  async addOption(ctx: any) {
    const { groupKey } = ctx.params;
    const { value } = ctx.request.body;

    if (!groupKey) return ctx.badRequest('groupKey is required');
    if (!value || typeof value !== 'string' || !value.trim()) {
      return ctx.badRequest('value is required and must be a non-empty string');
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

  async removeOption(ctx: any) {
    const { groupKey, value } = ctx.params;
    if (!groupKey || !value) return ctx.badRequest('groupKey and value are required');

    const decodedValue = decodeURIComponent(value);
    const options = await getStoredOptions(strapi, groupKey);
    const filtered = options.filter((opt) => opt !== decodedValue);

    await setStoredOptions(strapi, groupKey, filtered);
    ctx.body = { data: filtered };
  },

  async reorderOptions(ctx: any) {
    const { groupKey } = ctx.params;
    const { options } = ctx.request.body;

    if (!groupKey) return ctx.badRequest('groupKey is required');
    if (!Array.isArray(options)) return ctx.badRequest('options must be an array');

    await setStoredOptions(strapi, groupKey, options);
    ctx.body = { data: options };
  },
});

export default controller;
