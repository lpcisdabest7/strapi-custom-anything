#!/usr/bin/env node
/**
 * postinstall script for strapi-custom-anything
 *
 * Patches:
 * 1. strapi-plugin-multi-select → EnhancedMultiSelect (dynamic option adding)
 * 2. @strapi/admin Enumeration → Enhanced Enumeration (dynamic option adding for all enum fields)
 */
const { existsSync, copyFileSync, mkdirSync } = require('fs');
const { resolve, dirname, join } = require('path');

const TAG = '[strapi-custom-anything]';

/**
 * Walk up from this package to find the project's node_modules.
 */
function findNodeModules() {
  let dir = resolve(__dirname, '..');

  for (let i = 0; i < 10; i++) {
    const parent = dirname(dir);
    if (parent === dir) break;

    // Check if parent IS node_modules (e.g., node_modules/strapi-custom-anything/scripts)
    if (existsSync(join(parent, '@strapi')) || existsSync(join(parent, 'strapi-plugin-multi-select'))) {
      return parent;
    }

    const nmDir = join(parent, 'node_modules');
    if (existsSync(join(nmDir, '@strapi')) || existsSync(join(nmDir, 'strapi-plugin-multi-select'))) {
      return nmDir;
    }
    dir = parent;
  }
  return null;
}

const nodeModules = findNodeModules();

if (!nodeModules) {
  console.log(`${TAG} node_modules not found — skipping postinstall.`);
  process.exit(0);
}

const PATCHES = [
  {
    src: resolve(__dirname, '..', 'src', 'patches', 'multi-select-admin.mjs'),
    dest: join(nodeModules, 'strapi-plugin-multi-select', 'dist', 'admin', 'index.mjs'),
    label: 'multi-select admin/index.mjs (enhanced with dynamic option adding)',
    optional: true,
  },
  {
    src: resolve(__dirname, '..', 'src', 'patches', 'enumeration-admin.mjs'),
    dest: join(nodeModules, '@strapi', 'admin', 'dist', 'admin', 'admin', 'src', 'components', 'FormInputs', 'Enumeration.mjs'),
    label: '@strapi/admin Enumeration.mjs (enhanced with dynamic option adding)',
    optional: false,
  },
];

let applied = 0;
for (const patch of PATCHES) {
  if (!existsSync(patch.src)) {
    console.warn(`${TAG} Source not found: ${patch.src}`);
    continue;
  }
  if (!existsSync(dirname(patch.dest))) {
    if (patch.optional) {
      console.log(`${TAG} ⏭ ${patch.label} — target not found, skipping.`);
      continue;
    }
    console.warn(`${TAG} ⚠ Target dir not found for: ${patch.label}`);
    continue;
  }
  try {
    mkdirSync(dirname(patch.dest), { recursive: true });
    copyFileSync(patch.src, patch.dest);
    applied++;
    console.log(`${TAG} ✔ ${patch.label}`);
  } catch (err) {
    console.error(`${TAG} ✖ ${patch.label}: ${err.message}`);
  }
}
console.log(`${TAG} ${applied}/${PATCHES.length} patches applied.`);
