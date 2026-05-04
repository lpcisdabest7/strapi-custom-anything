#!/usr/bin/env node
/**
 * postinstall script for strapi-custom-anything
 *
 * Patches:
 * 1. strapi-plugin-multi-select → EnhancedMultiSelect (dynamic option adding)
 * 2. @strapi/content-manager admin validation → skip client-side enum oneOf check
 *    (server-side validator is patched at runtime by register.ts)
 */
const { existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } = require('fs');
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

// ─── Patch 1: Multi-select admin ───
const COPY_PATCHES = [
  {
    src: resolve(__dirname, '..', 'src', 'patches', 'multi-select-admin.mjs'),
    dest: join(nodeModules, 'strapi-plugin-multi-select', 'dist', 'admin', 'index.mjs'),
    label: 'multi-select admin/index.mjs (enhanced with dynamic option adding)',
    optional: true,
  },
  {
    src: resolve(__dirname, '..', 'src', 'patches', 'CellContent.mjs'),
    dest: join(nodeModules, '@strapi', 'content-manager', 'dist', 'admin', 'pages', 'ListView', 'components', 'TableCells', 'CellContent.mjs'),
    label: 'CellContent.mjs (list view component title display)',
    optional: true,
  },
  {
    src: resolve(__dirname, '..', 'src', 'patches', 'Repeatable.mjs'),
    dest: join(nodeModules, '@strapi', 'content-manager', 'dist', 'admin', 'pages', 'EditView', 'components', 'FormInputs', 'Component', 'Repeatable.mjs'),
    label: 'Repeatable.mjs (edit view component label display)',
    optional: true,
  },
];

let applied = 0;
for (const patch of COPY_PATCHES) {
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

// ─── Patch 2: Admin-side enum validation (skip oneOf for enumeration) ───
// The server-side validator is monkey-patched at runtime (register.ts).
// But Strapi's admin UI also validates enum values client-side before submitting.
// We patch validation.js to use string().nullable() instead of string().oneOf(...)
// so the admin UI accepts any value for enumeration fields.
const validationFile = join(
  nodeModules,
  '@strapi', 'content-manager', 'dist', 'admin', 'utils', 'validation.js'
);

if (existsSync(validationFile)) {
  try {
    let content = readFileSync(validationFile, 'utf8');

    // Original:  case 'enumeration': return yup.string().oneOf([...attribute.enum, null]);
    // Replace:   case 'enumeration': return yup.string().nullable();
    const oldPattern = `case 'enumeration':
            return yup__namespace.string().oneOf([
                ...attribute.enum,
                null
            ]);`;
    const newPattern = `case 'enumeration':
            return yup__namespace.string().nullable();`;

    if (content.includes(oldPattern)) {
      content = content.replace(oldPattern, newPattern);
      writeFileSync(validationFile, content, 'utf8');
      applied++;
      console.log(`${TAG} ✔ @strapi/content-manager validation.js (skip enum oneOf client-side)`);
    } else if (content.includes('yup__namespace.string().nullable()') && content.includes("case 'enumeration':")) {
      console.log(`${TAG} ⏭ @strapi/content-manager validation.js — already patched.`);
    } else {
      console.warn(`${TAG} ⚠ @strapi/content-manager validation.js — pattern not found, skipping.`);
    }
  } catch (err) {
    console.error(`${TAG} ✖ validation.js patch: ${err.message}`);
  }
} else {
  console.warn(`${TAG} ⚠ validation.js not found at: ${validationFile}`);
}

// Also patch the .mjs version if it exists
const validationMjsFile = validationFile.replace('.js', '.mjs');
if (existsSync(validationMjsFile)) {
  try {
    let content = readFileSync(validationMjsFile, 'utf8');

    const oldMjs = `case "enumeration":
            return yup.string().oneOf([
                ...attribute.enum,
                null
            ]);`;
    const newMjs = `case "enumeration":
            return yup.string().nullable();`;

    // Try both quote styles
    const patterns = [
      { old: oldMjs, new: newMjs },
      {
        old: `case 'enumeration':
            return yup.string().oneOf([
                ...attribute.enum,
                null
            ]);`,
        new: `case 'enumeration':
            return yup.string().nullable();`
      },
    ];

    let patched = false;
    for (const p of patterns) {
      if (content.includes(p.old)) {
        content = content.replace(p.old, p.new);
        writeFileSync(validationMjsFile, content, 'utf8');
        applied++;
        patched = true;
        console.log(`${TAG} ✔ @strapi/content-manager validation.mjs (skip enum oneOf client-side)`);
        break;
      }
    }
    if (!patched && !content.includes('.nullable()')) {
      console.warn(`${TAG} ⚠ validation.mjs — pattern not found, skipping.`);
    }
  } catch (err) {
    console.error(`${TAG} ✖ validation.mjs patch: ${err.message}`);
  }
}

// ─── Patch 3: Server-side enum validation (entity-validator) ───
// Strapi's entity-validator uses yup.string().oneOf(attr.enum) for enumeration fields.
// We patch it to yup.string().nullable() so dynamic values pass server-side validation.
const serverValidatorFile = join(
  nodeModules,
  '@strapi', 'core', 'dist', 'services', 'entity-validator', 'validators.js'
);

if (existsSync(serverValidatorFile)) {
  try {
    let content = readFileSync(serverValidatorFile, 'utf8');

    const oldServerPattern = `const enumerationValidator = ({ attr })=>{
    return strapiUtils.yup.string().oneOf((Array.isArray(attr.enum) ? attr.enum : [
        attr.enum
    ]).concat(null));
};`;
    const newServerPattern = `const enumerationValidator = ({ attr })=>{
    return strapiUtils.yup.string().nullable();
};`;

    if (content.includes(oldServerPattern)) {
      content = content.replace(oldServerPattern, newServerPattern);
      writeFileSync(serverValidatorFile, content, 'utf8');
      applied++;
      console.log(`${TAG} ✔ @strapi/core entity-validator (skip enum oneOf server-side)`);
    } else if (content.includes('nullable()') && content.includes('enumerationValidator')) {
      console.log(`${TAG} ⏭ @strapi/core entity-validator — already patched.`);
    } else {
      console.warn(`${TAG} ⚠ @strapi/core entity-validator — pattern not found, skipping.`);
    }
  } catch (err) {
    console.error(`${TAG} ✖ entity-validator patch: ${err.message}`);
  }
} else {
  console.warn(`${TAG} ⚠ entity-validator not found at: ${serverValidatorFile}`);
}

// ─── Patch 3b: Server-side enum validation ESM (.mjs) ───
const serverValidatorMjsFile = serverValidatorFile.replace('.js', '.mjs');

if (existsSync(serverValidatorMjsFile)) {
  try {
    let content = readFileSync(serverValidatorMjsFile, 'utf8');

    const oldMjsPattern = `const enumerationValidator = ({ attr })=>{
    return yup.string().oneOf((Array.isArray(attr.enum) ? attr.enum : [
        attr.enum
    ]).concat(null));
};`;
    const newMjsPattern = `const enumerationValidator = ({ attr })=>{
    return yup.string().nullable();
};`;

    if (content.includes(oldMjsPattern)) {
      content = content.replace(oldMjsPattern, newMjsPattern);
      writeFileSync(serverValidatorMjsFile, content, 'utf8');
      applied++;
      console.log(`${TAG} ✔ @strapi/core entity-validator.mjs (skip enum oneOf server-side)`);
    } else if (content.includes('nullable()') && content.includes('enumerationValidator')) {
      console.log(`${TAG} ⏭ @strapi/core entity-validator.mjs — already patched.`);
    } else {
      console.warn(`${TAG} ⚠ @strapi/core entity-validator.mjs — pattern not found, skipping.`);
    }
  } catch (err) {
    console.error(`${TAG} ✖ entity-validator.mjs patch: ${err.message}`);
  }
}

console.log(`${TAG} ${applied} patches applied.`);
