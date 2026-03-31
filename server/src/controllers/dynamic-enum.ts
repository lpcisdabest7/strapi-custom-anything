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

    // Also merge into in-memory schema so server-side validation accepts the new value
    mergeValueIntoSchema(strapi, groupKey, trimmedValue);

    ctx.body = { data: options };
  },

  async removeOption(ctx: any) {
    const { groupKey, value } = ctx.params;
    if (!groupKey || !value) return ctx.badRequest('groupKey and value are required');

    const decodedValue = decodeURIComponent(value);
    const options = await getStoredOptions(strapi, groupKey);
    const filtered = options.filter((opt) => opt !== decodedValue);

    await setStoredOptions(strapi, groupKey, filtered);

    // Remove from in-memory schema enum (only if it was a dynamic value, not schema-defined)
    removeValueFromSchema(strapi, groupKey, decodedValue);

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

/**
 * Resolve ALL matching schema enum attributes for a groupKey.
 * Handles both formats:
 *   - "uid::fieldName" → single specific component/content-type
 *   - "fieldName" (plain) → ALL components/content-types with that enum field
 */
function resolveAllSchemaAttributes(strapi: Core.Strapi, groupKey: string): any[] {
  const sepIdx = groupKey.lastIndexOf('::');

  if (sepIdx !== -1) {
    // Format: "uid::fieldName"
    const uid = groupKey.substring(0, sepIdx);
    const fieldName = groupKey.substring(sepIdx + 2);
    const schema = strapi.components?.[uid] || strapi.contentTypes?.[uid as any];
    const attr = schema?.attributes?.[fieldName];
    return attr?.type === 'enumeration' && Array.isArray(attr.enum) ? [attr] : [];
  }

  // Plain field name → find ALL matching enum fields across components & content-types
  const fieldName = groupKey;
  const results: any[] = [];

  for (const component of Object.values(strapi.components || {})) {
    const attr = (component as any)?.attributes?.[fieldName];
    if (attr?.type === 'enumeration' && Array.isArray(attr.enum)) {
      results.push(attr);
    }
  }
  for (const ct of Object.values(strapi.contentTypes || {})) {
    const attr = (ct as any)?.attributes?.[fieldName];
    if (attr?.type === 'enumeration' && Array.isArray(attr.enum)) {
      results.push(attr);
    }
  }

  return results;
}

function mergeValueIntoSchema(strapi: Core.Strapi, groupKey: string, value: string) {
  const attrs = resolveAllSchemaAttributes(strapi, groupKey);
  for (const attr of attrs) {
    if (!attr.enum.includes(value)) {
      attr.enum.push(value);
    }
  }
}

function removeValueFromSchema(strapi: Core.Strapi, groupKey: string, value: string) {
  const attrs = resolveAllSchemaAttributes(strapi, groupKey);
  for (const attr of attrs) {
    const idx = attr.enum.indexOf(value);
    if (idx !== -1) {
      attr.enum.splice(idx, 1);
    }
  }
}

export default controller;
