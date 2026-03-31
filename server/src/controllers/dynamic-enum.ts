import type { Core } from '@strapi/strapi';

const STORE_KEY_PREFIX = 'dynamic_enum_options_';
const DB_KEY_PREFIX = 'plugin_dynamic-enum_dynamic_enum_options_';

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

/**
 * Get ALL related groupKeys from DB that end with the same field name.
 * This collects options from all groupKey variants (plain, uid::field, path_based, parent.field).
 */
async function findAllRelatedKeys(strapi: Core.Strapi, groupKey: string): Promise<Array<{ key: string; value: string }>> {
  const fieldName = extractFieldName(groupKey);
  const knex = strapi.db?.connection || (strapi as any).db?.knex;
  if (!knex) return [];

  try {
    const rows = await knex('strapi_core_store_settings')
      .where('key', 'like', `${DB_KEY_PREFIX}%${fieldName}`)
      .select('key', 'value');
    return rows;
  } catch {
    return [];
  }
}

/**
 * Get merged unique options from ALL related groupKeys for a field.
 */
async function getAllRelatedOptions(strapi: Core.Strapi, groupKey: string): Promise<string[]> {
  const rows = await findAllRelatedKeys(strapi, groupKey);
  const merged = new Set<string>();

  for (const row of rows) {
    try {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (Array.isArray(parsed)) {
        parsed.forEach((v: string) => merged.add(v));
      }
    } catch {}
  }

  return Array.from(merged);
}

/**
 * Remove a value from ALL related groupKeys in DB.
 */
async function removeFromAllRelatedKeys(strapi: Core.Strapi, groupKey: string, value: string): Promise<void> {
  const rows = await findAllRelatedKeys(strapi, groupKey);

  for (const row of rows) {
    try {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (Array.isArray(parsed) && parsed.includes(value)) {
        const filtered = parsed.filter((v: string) => v !== value);
        const gk = row.key.substring(DB_KEY_PREFIX.length);
        await setStoredOptions(strapi, gk, filtered);
      }
    } catch {}
  }
}

/**
 * Extract the plain field name from any groupKey format:
 *   "vsl-common.preview::role" → "role"
 *   "cardPreviews.role" → "role"
 *   "screens_categories_cardPreviews_role" → "role"
 *   "role" → "role"
 */
function extractFieldName(groupKey: string): string {
  const sepIdx = groupKey.lastIndexOf('::');
  if (sepIdx !== -1) return groupKey.substring(sepIdx + 2);
  const dotIdx = groupKey.lastIndexOf('.');
  if (dotIdx !== -1) return groupKey.substring(dotIdx + 1);
  const underscoreIdx = groupKey.lastIndexOf('_');
  if (underscoreIdx !== -1) return groupKey.substring(underscoreIdx + 1);
  return groupKey;
}

/**
 * Add value to runtime cache AND mutate all schema enum arrays.
 */
function addToCache(strapi: Core.Strapi, groupKey: string, value: string) {
  const cache: Set<string> = (strapi as any).__dynamicEnumCache || new Set();
  cache.add(value);
  (strapi as any).__dynamicEnumCache = cache;

  // Also add to all matching schema enum arrays
  const fieldName = extractFieldName(groupKey);
  const allSchemas = [
    ...Object.values(strapi.components || {}),
    ...Object.values(strapi.contentTypes || {}),
  ];
  for (const schema of allSchemas) {
    const attr = (schema as any)?.attributes?.[fieldName];
    if (attr?.type === 'enumeration' && Array.isArray(attr.enum) && !attr.enum.includes(value)) {
      attr.enum.push(value);
    }
  }
}

/**
 * Remove value from runtime cache and schema enum arrays.
 */
async function removeFromCache(strapi: Core.Strapi, groupKey: string, value: string) {
  // Check if the value still exists in any other key
  const remaining = await getAllRelatedOptions(strapi, groupKey);
  if (!remaining.includes(value)) {
    const cache: Set<string> = (strapi as any).__dynamicEnumCache || new Set();
    cache.delete(value);
  }
}

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET: return all DB-stored dynamic options for this groupKey.
   */
  async getOptions(ctx: any) {
    const { groupKey } = ctx.params;
    if (!groupKey) return ctx.badRequest('groupKey is required');

    const allOptions = await getAllRelatedOptions(strapi, groupKey);
    ctx.body = { data: allOptions };
  },

  async addOption(ctx: any) {
    const { groupKey } = ctx.params;
    const { value } = ctx.request.body;

    if (!groupKey) return ctx.badRequest('groupKey is required');
    if (!value || typeof value !== 'string' || !value.trim()) {
      return ctx.badRequest('value is required and must be a non-empty string');
    }

    const trimmedValue = value.trim();

    // Check across ALL related keys
    const allOptions = await getAllRelatedOptions(strapi, groupKey);
    if (allOptions.includes(trimmedValue)) {
      return ctx.badRequest(`Option "${trimmedValue}" already exists`);
    }

    // Store under this specific groupKey
    const options = await getStoredOptions(strapi, groupKey);
    options.push(trimmedValue);
    await setStoredOptions(strapi, groupKey, options);

    // Update runtime cache (for validator)
    addToCache(strapi, groupKey, trimmedValue);

    // Return the full merged list
    const updatedAll = await getAllRelatedOptions(strapi, groupKey);
    ctx.body = { data: updatedAll };
  },

  /**
   * DELETE: remove option from ALL related groupKeys in DB.
   */
  async removeOption(ctx: any) {
    const { groupKey, value } = ctx.params;
    if (!groupKey || !value) return ctx.badRequest('groupKey and value are required');

    const decodedValue = decodeURIComponent(value);

    // Remove from ALL related keys in DB
    await removeFromAllRelatedKeys(strapi, groupKey, decodedValue);

    // Update runtime cache
    await removeFromCache(strapi, groupKey, decodedValue);

    // Return updated merged list
    const updatedAll = await getAllRelatedOptions(strapi, groupKey);
    ctx.body = { data: updatedAll };
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
