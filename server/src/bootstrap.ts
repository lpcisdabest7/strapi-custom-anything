import type { Core } from '@strapi/strapi';

const STORE_KEY_PREFIX = 'plugin_dynamic-enum_dynamic_enum_options_';

/**
 * On bootstrap: load ALL dynamic enum options from core_store and merge them
 * into the in-memory schema enum arrays. This is necessary because Strapi validates
 * enum values at multiple layers, and the only reliable way to make dynamic values
 * pass all validation is to add them to attr.enum directly.
 */
const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  const knex = strapi.db?.connection || (strapi as any).db?.knex;
  if (!knex) {
    strapi.log.warn('[dynamic-enum] Cannot access database connection for bootstrap');
    return;
  }

  // Step 1: Build map of fieldName → all enum attribute refs in schemas
  const enumFieldMap: Map<string, any[]> = new Map();

  for (const component of Object.values(strapi.components || {})) {
    if (!component?.attributes) continue;
    for (const [attrName, attr] of Object.entries(component.attributes as Record<string, any>)) {
      if (attr.type === 'enumeration' && Array.isArray(attr.enum)) {
        if (!enumFieldMap.has(attrName)) enumFieldMap.set(attrName, []);
        enumFieldMap.get(attrName)!.push(attr);
      }
    }
  }

  for (const ct of Object.values(strapi.contentTypes || {})) {
    if (!ct?.attributes) continue;
    for (const [attrName, attr] of Object.entries(ct.attributes as Record<string, any>)) {
      if (attr.type === 'enumeration' && Array.isArray(attr.enum)) {
        if (!enumFieldMap.has(attrName)) enumFieldMap.set(attrName, []);
        enumFieldMap.get(attrName)!.push(attr);
      }
    }
  }

  // Step 2: Load ALL dynamic options from DB
  let allRows: Array<{ key: string; value: string }> = [];
  try {
    allRows = await knex('strapi_core_store_settings')
      .where('key', 'like', `${STORE_KEY_PREFIX}%`)
      .select('key', 'value');
  } catch (err) {
    strapi.log.warn(`[dynamic-enum] Failed to query core_store: ${err}`);
    return;
  }

  // Step 3: Group dynamic values by field name
  const dynamicByField: Map<string, Set<string>> = new Map();
  for (const row of allRows) {
    const groupKey = row.key.replace(STORE_KEY_PREFIX, '');
    const fieldName = extractFieldName(groupKey);

    let values: string[] = [];
    try {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      values = Array.isArray(parsed) ? parsed : [];
    } catch { continue; }

    if (!dynamicByField.has(fieldName)) dynamicByField.set(fieldName, new Set());
    values.forEach((v) => dynamicByField.get(fieldName)!.add(v));
  }

  // Step 4: Merge dynamic values into ALL matching schema enum arrays
  let totalAdded = 0;
  for (const [fieldName, dynamicValues] of dynamicByField.entries()) {
    const attrs = enumFieldMap.get(fieldName);
    if (!attrs || attrs.length === 0) continue;

    for (const attr of attrs) {
      const enumSet = new Set(attr.enum as string[]);
      for (const val of dynamicValues) {
        if (!enumSet.has(val)) {
          attr.enum.push(val);
          enumSet.add(val);
          totalAdded++;
        }
      }
    }
  }

  // Also store in runtime cache for controller use
  const allDynamic = new Set<string>();
  for (const vals of dynamicByField.values()) {
    vals.forEach((v) => allDynamic.add(v));
  }
  (strapi as any).__dynamicEnumCache = allDynamic;

  strapi.log.info(`[dynamic-enum] Bootstrap: merged ${totalAdded} dynamic enum values into schemas`);
};

function extractFieldName(groupKey: string): string {
  const sepIdx = groupKey.lastIndexOf('::');
  if (sepIdx !== -1) return groupKey.substring(sepIdx + 2);
  const dotIdx = groupKey.lastIndexOf('.');
  if (dotIdx !== -1) return groupKey.substring(dotIdx + 1);
  const underscoreIdx = groupKey.lastIndexOf('_');
  if (underscoreIdx !== -1) return groupKey.substring(underscoreIdx + 1);
  return groupKey;
}

export default bootstrap;
