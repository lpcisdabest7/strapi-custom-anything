# strapi-custom-anything

A Strapi v5 custom field plugin that provides **dynamic enum values** — add, remove, and manage enum options directly from the admin panel without rebuilding.

## Features

- **Dynamic Options**: Add new enum values via a "+" button right in the content editor
- **No Rebuild Required**: Options are stored in the database, not in the schema
- **Shared Option Groups**: Fields with the same `groupKey` share the same options list
- **Multi-Select**: Select multiple values from the dynamic options list
- **Options Manager**: View and delete available options inline
- **JSON Storage**: Data stored as JSON array (e.g., `["HOT", "TRENDING", "NEW"]`)

## Installation

```bash
# From git
npm install git+https://github.com/lpcisdabest7/strapi-custom-anything.git
```

Add to `package.json`:

```json
{
  "dependencies": {
    "strapi-custom-anything": "git+https://github.com/lpcisdabest7/strapi-custom-anything.git"
  }
}
```

## Configuration

Enable the plugin in `config/plugins.ts`:

```typescript
export default ({ env }) => ({
  'dynamic-enum': {
    enabled: true,
  },
  // ... other plugins
});
```

## Usage

### 1. Add the field

Go to **Content-Type Builder** → **Add another field** → **Custom** tab → Select **Dynamic Enum**

### 2. Configure Group Key

In the field configuration, set the **Group Key** — a unique identifier for the set of options.

Fields sharing the same group key will share the same options list across different content types.

### 3. Manage options

When editing content:

- **Select** existing values from the dropdown
- **Type** a new option in the input field and click **"+"** to add it
- Click **"Manage"** to view all available options and remove unwanted ones

### Example

```
Group Key: "tags"
Available options: ["HOT", "TRENDING", "NEW", "FEATURED"]
Selected values (stored as JSON): ["HOT", "NEW"]
```

## API

The plugin exposes admin API endpoints for managing options:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dynamic-enum/options/:groupKey` | Get all options for a group |
| `POST` | `/dynamic-enum/options/:groupKey` | Add a new option (`{ value: "..." }`) |
| `DELETE` | `/dynamic-enum/options/:groupKey/:value` | Remove an option |
| `PUT` | `/dynamic-enum/options/:groupKey/reorder` | Reorder options (`{ options: [...] }`) |

All endpoints require admin authentication.

## How it works

- **Custom Field Type**: Registered as `plugin::dynamic-enum.dynamic-enum` with underlying `json` type
- **Options Storage**: Uses Strapi's `core_store` table via `strapi.store` with key pattern `plugin_dynamic_enum_options_{groupKey}`
- **Data Storage**: Selected values stored as JSON array in the content entry

## Requirements

- Strapi v5.x
- Node.js >= 18

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch
```

## License

MIT
