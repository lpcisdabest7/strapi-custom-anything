import type { Core } from '@strapi/strapi';

/**
 * On bootstrap: load dynamic enum options from DB into a runtime cache.
 * The enumeration validator is already patched in register.ts to accept any value,
 * so we do NOT mutate attr.enum (which would pollute auto-generated types).
 */
const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  const knex = strapi.db?.connection || (strapi as any).db?.knex;
  if (!knex) {
    strapi.log.warn('[dynamic-enum] Cannot access database connection for bootstrap');
    return;
  }

  const STORE_KEY_PREFIX = 'plugin_dynamic-enum_dynamic_enum_options_';

  let allRows: Array<{ key: string; value: string }> = [];
  try {
    allRows = await knex('strapi_core_store_settings')
      .where('key', 'like', `${STORE_KEY_PREFIX}%`)
      .select('key', 'value');
  } catch (err) {
    strapi.log.warn(`[dynamic-enum] Failed to query core_store: ${err}`);
    return;
  }

  // Build runtime cache of all dynamic options (for reference only)
  const allDynamic = new Set<string>();
  let totalOptions = 0;

  for (const row of allRows) {
    try {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (Array.isArray(parsed)) {
        parsed.forEach((v: string) => allDynamic.add(v));
        totalOptions += parsed.length;
      }
    } catch { continue; }
  }

  (strapi as any).__dynamicEnumCache = allDynamic;

  strapi.log.info(`[dynamic-enum] Bootstrap: loaded ${totalOptions} dynamic options into cache (no schema mutation)`);
};

export default bootstrap;
