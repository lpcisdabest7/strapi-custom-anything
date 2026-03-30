import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register({
    name: 'dynamic-enum',
    plugin: 'dynamic-enum',
    type: 'string',
    inputSize: {
      default: 12,
      isResizable: true,
    },
  });
};

export default register;
