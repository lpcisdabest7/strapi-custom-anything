#!/usr/bin/env node
/**
 * postinstall script for strapi-custom-anything
 *
 * Copies patched admin entry point over strapi-plugin-multi-select's
 * to load EnhancedMultiSelect instead of original Input component.
 *
 * Same approach as strapi-custom-duplicate's postinstall.
 */
const { existsSync, copyFileSync, mkdirSync } = require('fs');
const { resolve, dirname, join } = require('path');

const TAG = '[strapi-custom-anything]';

/**
 * Walk up from this package to find the project's node_modules
 * that contains strapi-plugin-multi-select.
 */
function findNodeModules() {
  let dir = resolve(__dirname, '..');

  for (let i = 0; i < 10; i++) {
    const parent = dirname(dir);
    if (parent === dir) break;

    if (existsSync(join(parent, 'strapi-plugin-multi-select'))) {
      return parent;
    }

    const nmDir = join(parent, 'node_modules');
    if (existsSync(join(nmDir, 'strapi-plugin-multi-select'))) {
      return nmDir;
    }
    dir = parent;
  }
  return null;
}

const nodeModules = findNodeModules();

if (!nodeModules) {
  console.log(`${TAG} strapi-plugin-multi-select not found — skipping postinstall.`);
  process.exit(0);
}

const PATCHES = [
  {
    src: resolve(__dirname, '..', 'src', 'patches', 'multi-select-admin.mjs'),
    dest: join(nodeModules, 'strapi-plugin-multi-select', 'dist', 'admin', 'index.mjs'),
    label: 'multi-select admin/index.mjs (enhanced with dynamic option adding)',
  },
];

let applied = 0;
for (const patch of PATCHES) {
  if (!existsSync(patch.src)) {
    console.warn(`${TAG} Source not found: ${patch.src}`);
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
