import DynamicEnumIcon from './components/DynamicEnumIcon';
import EnhancedEnumeration from './components/EnhancedEnumeration';

const PLUGIN_ID = 'dynamic-enum';

export default {
  register(app: any) {
    // Override built-in enumeration field globally with enhanced version
    // This adds "+" button to ALL enumeration fields automatically
    app.addFields({
      type: 'enumeration',
      Component: EnhancedEnumeration,
    });

    app.customFields.register({
      name: PLUGIN_ID,
      pluginId: PLUGIN_ID,
      type: 'string',
      icon: DynamicEnumIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.label`,
        defaultMessage: 'Dynamic Enum',
      },
      intlDescription: {
        id: `${PLUGIN_ID}.description`,
        defaultMessage:
          'Single-select with ability to add new enum values dynamically. Merges schema options + DB options.',
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
              id: `${PLUGIN_ID}.section.enum`,
              defaultMessage: 'Enum values',
            },
            items: [
              {
                name: 'options',
                type: 'textarea-enum',
                intlLabel: {
                  id: `${PLUGIN_ID}.enum.label`,
                  defaultMessage: 'Options (one per line)',
                },
                description: {
                  id: `${PLUGIN_ID}.enum.description`,
                  defaultMessage:
                    'Default enum values (read-only in CMS). Users can add more values dynamically via the "+" button.',
                },
                placeholder: {
                  id: `${PLUGIN_ID}.enum.placeholder`,
                  defaultMessage: 'Ex:\nBEFORE\nAFTER\nSINGLE',
                },
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
                  defaultMessage:
                    "You won't be able to create an entry if this field is empty",
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
