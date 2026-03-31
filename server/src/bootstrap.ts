import type { Core } from '@strapi/strapi';

const STORE_KEY_PREFIX = 'dynamic_enum_options_';

/**
 * On bootstrap: scan all components & content-types for enumeration fields,
 * load dynamic options from core_store (both "uid::field" and plain "field" keys),
 * and merge them into the in-memory schema.
 *
 * The frontend groupKey depends on whether useComponent() hook works:
 *   - Works:  "vsl-common.preview::role"
 *   - Fails:  "role" (plain field name fallback)
 * We must check BOTH formats and merge all found options.
 */
const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Build a map: fieldName -> list of schema attribute refs that need merging
  // This allows us to merge plain-key options into ALL matching components
  const fieldMap: Map<string, Array<{ attributes: Record<string, any>; attrName: string; uid: string }>> = new Map();

  // Process components
  const components = strapi.components || {};
  for (const [uid, component] of Object.entries(components)) {
    if (!component?.attributes) continue;
    for (const [attrName, attr] of Object.entries(component.attributes as Record<string, any>)) {
      if (attr.type !== 'enumeration' || !Array.isArray(attr.enum)) continue;

      // Merge uid::field key
      await mergeEnumOptions(strapi, attr, `${uid}::${attrName}`);

      // Track for plain-key merging
      if (!fieldMap.has(attrName)) fieldMap.set(attrName, []);
      fieldMap.get(attrName)!.push({ attributes: component.attributes as Record<string, any>, attrName, uid });
    }
  }

  // Process content-types
  const contentTypes = strapi.contentTypes || {};
  for (const [uid, ct] of Object.entries(contentTypes)) {
    if (!ct?.attributes) continue;
    for (const [attrName, attr] of Object.entries(ct.attributes as Record<string, any>)) {
      if (attr.type !== 'enumeration' || !Array.isArray(attr.enum)) continue;

      await mergeEnumOptions(strapi, attr, `${uid}::${attrName}`);

      if (!fieldMap.has(attrName)) fieldMap.set(attrName, []);
      fieldMap.get(attrName)!.push({ attributes: ct.attributes as Record<string, any>, attrName, uid });
    }
  }

  // Now merge plain-key options (fallback groupKey = just fieldName)
  // These options should be merged into ALL components/content-types that have that enum field
  for (const [fieldName, targets] of fieldMap.entries()) {
    const stored = await getStoredOptions(strapi, fieldName);
    if (!stored || stored.length === 0) continue;

    for (const { attributes, attrName } of targets) {
      const attr = attributes[attrName];
      const enumSet = new Set(attr.enum as string[]);
      for (const val of stored) {
        if (!enumSet.has(val)) {
          attr.enum.push(val);
          enumSet.add(val);
        }
      }
    }
    strapi.log.debug(`[dynamic-enum] plain key "${fieldName}": merged into ${targets.length} schema(s)`);
  }

  strapi.log.info('[dynamic-enum] Bootstrap: merged dynamic enum options into schemas');
};

async function getStoredOptions(strapi: Core.Strapi, groupKey: string): Promise<string[]> {
  try {
    const stored = await strapi.store.get({
      type: 'plugin',
      name: 'dynamic-enum',
      key: `${STORE_KEY_PREFIX}${groupKey}`,
    });
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function mergeEnumOptions(strapi: Core.Strapi, attr: any, groupKey: string) {
  const stored = await getStoredOptions(strapi, groupKey);
  if (stored.length === 0) return;

  const currentEnum: string[] = attr.enum;
  const enumSet = new Set(currentEnum);
  let added = 0;
  for (const val of stored) {
    if (!enumSet.has(val)) {
      currentEnum.push(val);
      enumSet.add(val);
      added++;
    }
  }
  if (added > 0) {
    strapi.log.debug(`[dynamic-enum] ${groupKey}: added ${added} dynamic values`);
  }
}

export default bootstrap;
