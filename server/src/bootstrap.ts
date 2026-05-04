import type { Core } from '@strapi/strapi';

const LABEL_FIELDS = ['_preview','name','title','defaultName','code','content','label','displayName','slug','role','action','placement','useCase','useCaseId'];
const LABEL_SKIP = new Set(['id','documentId','__component','createdAt','updatedAt','publishedAt','locale']);

function extractLabel(obj: Record<string, any>): string {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of LABEL_FIELDS) {
    if (typeof obj[key] === 'string' && obj[key]) return obj[key];
  }
  for (const [k, v] of Object.entries(obj)) {
    if (LABEL_SKIP.has(k)) continue;
    if (typeof v === 'string' && v && v.length < 100) return v;
  }
  return '';
}

function flattenComponentValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    if (val.length > 0 && val[0] && typeof val[0] === 'object') {
      const label = extractLabel(val[0]);
      if (label) return val.length > 1 ? `${label} (+${val.length - 1})` : label;
    }
    return val;
  }
  if (typeof val === 'object') {
    const label = extractLabel(val);
    return label || val;
  }
  return val;
}

/**
 * On bootstrap: load dynamic enum options from DB into a runtime cache.
 * The enumeration validator is already patched in register.ts to accept any value,
 * so we do NOT mutate attr.enum (which would pollute auto-generated types).
 */
const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Flatten component fields in list-view API responses so they show meaningful text
  strapi.server.use(async (ctx: any, next: () => Promise<void>) => {
    await next();

    const path: string = ctx.request?.url || ctx.request?.path || '';
    if (ctx.request.method !== 'GET') return;
    if (!path.includes('/collection-types/')) return;

    const idx = path.indexOf('/collection-types/');
    const rest = path.substring(idx + '/collection-types/'.length).split('?')[0];
    const segments = rest.split('/').filter(Boolean);
    if (segments.length !== 1) return;

    const uid = segments[0];
    const body = ctx.body;
    if (!body?.results || !Array.isArray(body.results)) return;

    const schema = (strapi as any).contentTypes[uid];
    if (!schema) return;

    const attributes = schema.attributes || {};
    const componentFields: string[] = [];
    for (const [fieldName, attr] of Object.entries(attributes) as [string, any][]) {
      if (attr.type === 'component' || attr.type === 'dynamiczone') {
        componentFields.push(fieldName);
      }
    }
    if (componentFields.length === 0) return;

    for (const record of body.results) {
      for (const field of componentFields) {
        const val = record[field];
        if (val !== undefined && val !== null && typeof val === 'object') {
          record[field] = flattenComponentValue(val);
        }
      }
    }
  });

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
