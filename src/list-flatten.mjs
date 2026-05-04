/**
 * Middleware that flattens component field values in content-manager list API responses
 * so that list view columns show meaningful text instead of "N items".
 */

const LABEL_FIELDS = [
  '_preview', 'name', 'title', 'defaultName', 'code', 'content',
  'label', 'displayName', 'slug', 'role', 'action', 'placement',
  'useCase', 'useCaseId',
];

function extractLabel(obj) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of LABEL_FIELDS) {
    if (typeof obj[key] === 'string' && obj[key]) return obj[key];
  }
  const skip = new Set(['id', 'documentId', '__component', 'createdAt', 'updatedAt', 'publishedAt', 'locale']);
  for (const [k, v] of Object.entries(obj)) {
    if (skip.has(k)) continue;
    if (typeof v === 'string' && v && v.length < 100) return v;
  }
  return '';
}

function flattenValue(val) {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) {
    if (val.length > 0 && val[0] && typeof val[0] === 'object') {
      const label = extractLabel(val[0]);
      if (label) {
        return val.length > 1 ? `${label} (+${val.length - 1})` : label;
      }
    }
    return `${val.length} item${val.length !== 1 ? 's' : ''}`;
  }
  if (typeof val === 'object') {
    return extractLabel(val);
  }
  return '';
}

export default () => {
  return async (ctx, next) => {
    await next();

    const path = ctx.request?.url || ctx.request?.path || '';
    if (ctx.request.method !== 'GET') return;
    if (!path.includes('/collection-types/')) return;

    const idx = path.indexOf('/collection-types/');
    const rest = path.substring(idx + '/collection-types/'.length).split('?')[0];
    const segments = rest.split('/').filter(Boolean);

    // Only list endpoints (1 segment = model UID), skip single-record fetches
    if (segments.length !== 1) return;

    const uid = segments[0];
    const body = ctx.body;
    if (!body?.results || !Array.isArray(body.results)) return;

    const schema = strapi.contentTypes[uid];
    if (!schema) return;

    const attributes = schema.attributes || {};

    const componentFields = [];
    for (const [fieldName, attr] of Object.entries(attributes)) {
      if (attr.type === 'component' || attr.type === 'dynamiczone') {
        componentFields.push(fieldName);
      }
    }

    if (componentFields.length === 0) return;

    for (const record of body.results) {
      for (const field of componentFields) {
        const val = record[field];
        if (val !== undefined && val !== null && typeof val === 'object') {
          record[field] = flattenValue(val);
        }
      }
    }
  };
};
