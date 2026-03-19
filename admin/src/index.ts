import DynamicEnumIcon from './components/DynamicEnumIcon';

const PLUGIN_ID = 'dynamic-enum';

export default {
  register(app: any) {
    app.customFields.register({
      name: PLUGIN_ID,
      pluginId: PLUGIN_ID,
      type: 'json',
      icon: DynamicEnumIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.label`,
        defaultMessage: 'Dynamic Enum',
      },
      intlDescription: {
        id: `${PLUGIN_ID}.description`,
        defaultMessage: 'Select multiple options with ability to add new values dynamically',
      },
      components: {
        Input: async () =>
          import('./components/DynamicEnumInput').then((m) => ({
            default: m.default,
          })),
      },
      options: {
        base: [
          {
            sectionTitle: {
              id: `${PLUGIN_ID}.section.config`,
              defaultMessage: 'Configuration',
            },
            items: [
              {
                intlLabel: {
                  id: `${PLUGIN_ID}.groupKey.label`,
                  defaultMessage: 'Group Key',
                },
                description: {
                  id: `${PLUGIN_ID}.groupKey.description`,
                  defaultMessage:
                    'Unique identifier for this set of options. Fields sharing the same group key will share the same options list.',
                },
                name: 'options.groupKey',
                type: 'text',
              },
            ],
          },
        ],
        advanced: [
          {
            sectionTitle: {
              id: 'global.settings',
              defaultMessage: 'Settings',
            },
            items: [
              {
                name: 'required',
                type: 'checkbox',
                intlLabel: {
                  id: 'form.attribute.item.requiredField',
                  defaultMessage: 'Required field',
                },
                description: {
                  id: 'form.attribute.item.requiredField.description',
                  defaultMessage: "You won't be able to create an entry if this field is empty",
                },
              },
              {
                name: 'private',
                type: 'checkbox',
                intlLabel: {
                  id: 'form.attribute.item.privateField',
                  defaultMessage: 'Private field',
                },
                description: {
                  id: 'form.attribute.item.privateField.description',
                  defaultMessage: 'This field will not show up in the API response',
                },
              },
            ],
          },
        ],
      },
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    const importedTrads = await Promise.all(
      locales.map((locale: string) => {
        return import(`./translations/${locale}.json`)
          .then(({ default: data }) => ({
            data: prefixPluginTranslations(data, PLUGIN_ID),
            locale,
          }))
          .catch(() => ({ data: {}, locale }));
      })
    );
    return importedTrads;
  },
};

function prefixPluginTranslations(trad: Record<string, string>, pluginId: string) {
  return Object.keys(trad).reduce(
    (acc, current) => {
      acc[`${pluginId}.${current}`] = trad[current];
      return acc;
    },
    {} as Record<string, string>
  );
}
