#!/usr/bin/env node
/**
 * postinstall script for strapi-custom-anything
 *
 * Patches strapi-plugin-multi-select's admin entry points to load
 * the enhanced multi-select component (with "+" add option button).
 *
 * Similar approach to strapi-custom-duplicate's postinstall.
 */
const fs = require('fs');
const path = require('path');

const TAG = '[strapi-custom-anything]';

function findMultiSelectDir() {
  // Walk up from this package to find the project's node_modules
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    dir = path.dirname(dir);
    const candidate = path.join(dir, 'node_modules', 'strapi-plugin-multi-select');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findThisPackageDir() {
  return path.resolve(__dirname, '..');
}

function patchFile(filePath, isESM) {
  if (!fs.existsSync(filePath)) {
    console.log(`${TAG} Skipping ${filePath} (not found)`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Already patched?
  if (content.includes('strapi-custom-anything')) {
    console.log(`${TAG} Already patched: ${filePath}`);
    return true;
  }

  // Find the Input component import line
  // ESM: import("../_chunks/index-XXXX.mjs")
  // CJS: require("../_chunks/index-XXXX.js")
  let patched;
  if (isESM) {
    patched = content.replace(
      /Input:\s*async\s*\(\)\s*=>\s*import\(["'][^"']+["']\)/,
      `Input: async () => import("strapi-custom-anything/EnhancedMultiSelect") /* patched by strapi-custom-anything */`
    );
  } else {
    patched = content.replace(
      /Input:\s*async\s*\(\)\s*=>\s*Promise\.resolve\(\)\.then\(\(\)\s*=>\s*require\(["'][^"']+["']\)\)/,
      `Input: async () => Promise.resolve().then(() => require("strapi-custom-anything/EnhancedMultiSelect")) /* patched by strapi-custom-anything */`
    );
  }

  if (patched === content) {
    console.log(`${TAG} Could not find Input import pattern in: ${filePath}`);
    return false;
  }

  fs.writeFileSync(filePath, patched, 'utf8');
  console.log(`${TAG} ✅ Patched: ${filePath}`);
  return true;
}

function main() {
  console.log(`${TAG} Running postinstall...`);

  const multiSelectDir = findMultiSelectDir();
  if (!multiSelectDir) {
    console.log(`${TAG} strapi-plugin-multi-select not found, skipping patch.`);
    return;
  }

  console.log(`${TAG} Found multi-select at: ${multiSelectDir}`);

  const adminMjs = path.join(multiSelectDir, 'dist', 'admin', 'index.mjs');
  const adminJs = path.join(multiSelectDir, 'dist', 'admin', 'index.js');

  const patchedMjs = patchFile(adminMjs, true);
  const patchedJs = patchFile(adminJs, false);

  if (patchedMjs || patchedJs) {
    console.log(`${TAG} ✅ Multi-select enhanced with dynamic option adding!`);
  } else {
    console.log(`${TAG} ⚠️  No files were patched.`);
  }
}

main();
