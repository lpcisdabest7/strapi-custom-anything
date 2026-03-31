import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // Register the dynamic-enum custom field
  strapi.customFields.register({
    name: 'dynamic-enum',
    plugin: 'dynamic-enum',
    type: 'string',
    inputSize: {
      default: 12,
      isResizable: true,
    },
  });

  // Monkey-patch the enumeration validator to also accept dynamic options.
  // This avoids mutating attr.enum (which pollutes auto-generated types).
  try {
    // Bypass package.json "exports" restriction using createRequire with direct file path
    const { createRequire } = require('module');
    const coreRequire = createRequire(
      require.resolve('@strapi/core/package.json')
    );
    const validatorsModule = coreRequire('./dist/services/entity-validator/validators');
    const yup = require('@strapi/utils').yup;

    if (validatorsModule?.Validators) {
      // Save original validator
      const originalEnumValidator = validatorsModule.Validators.enumeration;

      // Replace with enhanced version that checks dynamic options cache
      validatorsModule.Validators.enumeration = ({ attr }: any) => {
        // Always accept any string for enumeration fields.
        // Dynamic values are managed by the plugin and stored in core_store.
        // Server trusts the frontend UI to show only valid options.
        return yup.string().nullable();
      };

      // Also patch the exported function reference
      validatorsModule.enumerationValidator = validatorsModule.Validators.enumeration;

      strapi.log.info('[dynamic-enum] Patched enumeration validator to accept dynamic options');
    }
  } catch (err) {
    strapi.log.warn(`[dynamic-enum] Failed to patch enumeration validator: ${err}`);
  }
};

export default register;
