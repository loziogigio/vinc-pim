# Menu Settings

Navigation menus for storefronts — header, footer, mobile, and mega menu. Merchants build hierarchical menus from entity references (categories, brands, collections, products, tags, product types), custom URLs, saved searches, pages, and visual dividers. Menus are **multi-channel** — each item is scoped to a sales channel (e.g., `default`, `b2c`, `b2b`) and can have **time-bound visibility** via start/end dates.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MenuItem (MongoDB)                                              │
│  Standalone document in `menuitems` collection                   │
│  Fields: menu_item_id, location, channel, type, reference_id,   │
│          label, url, parent_id, level, path[], position          │
└──────────────────────────────────────────────────────────────────┘
          │                                    │
    B2B Admin UI                         Public API
    (drag-and-drop builder)              (storefront rendering)
          │                                    │
          ▼                                    ▼
┌──────────────────────┐        ┌──────────────────────────────┐
│  /api/b2b/menu       │        │  /api/public/menu            │
│  CRUD + reorder      │        │  Returns hierarchical tree   │
│  + import            │        │  with resolved URLs          │
└──────────────────────┘        └──────────────────────────────┘
          │                                    │
          └──── invalidateB2CCache ────────────┘
```

### Key Design Decisions

- **Entity-based references.** Items of type `category`, `brand`, `collection`, `tag`, `product_type`, or `product` store only `reference_id`. The public API resolves these to filter URLs (`/search?filters-category_id=...`) at read time.
- **Hierarchical path array.** Each item stores `path[]` (ancestor IDs from root to parent) for O(1) descendant queries (`{ path: itemId }` finds all descendants).
- **Position-based ordering.** Items within the same parent are ordered by `position`. The reorder endpoint batch-updates positions for drag-and-drop.
- **Cache invalidation.** Every mutation invalidates the B2C Redis cache (`menu` key) so the storefront reflects changes immediately.

---

## Data Model

### MenuItem Document (MongoDB)

Collection: `menuitems`

```typescript
interface IMenuItem {
  menu_item_id: string;       // Unique ID (nanoid, 12 chars)

  // Scoping
  location: MenuLocation;     // "header" | "footer" | "mobile" | "mega_menu"
  channel: string;            // Sales channel (default: "default")

  // Item type and entity reference
  type: MenuItemType;         // See table below
  reference_id?: string;      // Entity ID (category_id, brand_id, etc.)

  // Display
  label?: string;             // Custom label (overrides entity name)
  url?: string;               // Custom URL (required for type "url")
  icon?: string;              // Icon URL or class
  rich_text?: string;         // Rich text description
  image_url?: string;         // Desktop banner image
  mobile_image_url?: string;  // Mobile banner image

  // Hierarchy
  parent_id?: string;         // Parent menu_item_id (null = root)
  level: number;              // Depth: 0 = root, 1 = child, ...
  path: string[];             // Ancestor IDs [root_id, ..., parent_id]

  // Hierarchy config
  include_children: boolean;  // Auto-expand entity's children in storefront
  max_depth?: number;         // Limit child depth (null = unlimited)

  // Positioning
  position: number;           // Order within same parent (0-based)

  // Visibility
  is_active: boolean;         // Enabled/disabled toggle
  start_date?: Date;          // Show from (promotional scheduling)
  end_date?: Date;            // Hide after

  // Behavior
  open_in_new_tab: boolean;   // Target="_blank"
  css_class?: string;         // Custom CSS class

  // Timestamps
  created_at: Date;
  updated_at: Date;
}
```

### Menu Item Types

| Type | `reference_id` | `url` | Description |
|------|:-:|:-:|-------------|
| `category` | Required | - | Link to a category (supports `include_children`) |
| `brand` | Required | - | Link to a brand |
| `collection` | Required | - | Link to a collection |
| `tag` | Required | - | Link to a tag |
| `product_type` | Required | - | Link to a product type |
| `product` | Required | - | Link to a specific product |
| `page` | - | Optional | Link to a custom page |
| `url` | - | Required | Custom URL or external link |
| `search` | - | Optional | Saved search query (url = search text) |
| `text` | - | - | Plain text label (no link, useful for group headers) |
| `divider` | - | - | Visual separator (no link) |

### Menu Locations

| Location | Description |
|----------|-------------|
| `header` | Top navigation bar |
| `footer` | Footer navigation |
| `mobile` | Mobile-specific navigation |
| `mega_menu` | Mega menu dropdown |

### Indexes

```
{ menu_item_id: 1 }                                     — unique
{ channel: 1, location: 1, parent_id: 1, position: 1 } — query + sort
{ is_active: 1, start_date: 1, end_date: 1 }            — visibility filter
{ type: 1, reference_id: 1 }                             — entity lookup
```

---

## Hierarchy Example

```
header / default channel
├── [category] Prodotti          (level 0, position 0)
│   ├── [category] Tavola        (level 1, position 0)
│   │   └── [category] Bicchieri (level 2, position 0)
│   ├── [category] Contenitori   (level 1, position 1)
│   └── [brand] Flo SpA          (level 1, position 2)
├── [collection] Novità          (level 0, position 1)
├── [url] Chi Siamo              (level 0, position 2)
│   url: "/about"
├── [search] Offerte             (level 0, position 3)
│   url: "offerte"  →  /search?text=offerte
└── [divider]                    (level 0, position 4)
```

The `path` field for "Bicchieri" would be `["<prodotti_id>", "<tavola_id>"]` — its two ancestor IDs, enabling `{ path: "<prodotti_id>" }` to find all descendants of "Prodotti".

---

## API Endpoints

Base: `/api/b2b/menu`

Auth: Session, API key, or Bearer JWT (via `requireTenantAuth`)

### List Menu Items

```
GET /api/b2b/menu
```

| Param | Type | Required | Description |
|-------|------|:--------:|-------------|
| `location` | string | No | Filter by location (`header`, `footer`, `mobile`, `mega_menu`) |
| `channel` | string | No | Sales channel (default: `"default"`) |
| `include_inactive` | boolean | No | Include disabled and time-expired items |

Returns items sorted by `parent_id, position`.

When `include_inactive` is omitted or `false`, the query filters:
- `is_active: true`
- Time bounds: items without dates, or where `start_date <= now` and/or `end_date >= now`

```json
{
  "menuItems": [
    {
      "menu_item_id": "TkOehdTBEl1H",
      "location": "header",
      "channel": "default",
      "type": "category",
      "reference_id": "cat-prodotti",
      "label": "Prodotti",
      "parent_id": null,
      "level": 0,
      "path": [],
      "position": 0,
      "is_active": true,
      "include_children": false,
      "open_in_new_tab": false,
      "created_at": "2025-06-15T10:30:00Z",
      "updated_at": "2025-06-15T10:30:00Z"
    }
  ]
}
```

### Create Menu Item

```
POST /api/b2b/menu
```

```json
{
  "location": "header",
  "channel": "default",
  "type": "category",
  "reference_id": "cat-prodotti",
  "label": "Prodotti",
  "icon": "https://cdn.example.com/icons/prodotti.svg",
  "image_url": "https://cdn.example.com/banners/prodotti.jpg",
  "mobile_image_url": "https://cdn.example.com/banners/prodotti-mobile.jpg",
  "rich_text": "<p>Scopri i nostri prodotti</p>",
  "parent_id": null,
  "include_children": true,
  "max_depth": 2,
  "is_active": true,
  "start_date": "2025-07-01T00:00:00Z",
  "end_date": "2025-12-31T23:59:59Z",
  "open_in_new_tab": false,
  "css_class": "highlight-menu"
}
```

**Validation:**
- `location` and `type` are required
- `reference_id` is required for entity types (`category`, `brand`, `collection`, `tag`, `product_type`, `product`)
- `url` is required for type `url`
- If `parent_id` is provided, the parent must exist

**Auto-calculated fields:**
- `menu_item_id` — generated via `nanoid(12)`
- `level` — `parent.level + 1` (or `0` for root)
- `path` — `[...parent.path, parent.menu_item_id]` (or `[]` for root)
- `position` — appended after the last item in the same parent

**Response:** `201 Created`

```json
{
  "menuItem": { /* full IMenuItem document */ }
}
```

### Get Single Menu Item

```
GET /api/b2b/menu/{menu_item_id}
```

```json
{
  "menuItem": { /* full IMenuItem document */ }
}
```

### Update Menu Item

```
PATCH /api/b2b/menu/{menu_item_id}
```

All fields are optional. Only provided fields are updated.

```json
{
  "label": "Prodotti Aggiornati",
  "is_active": false,
  "include_children": true,
  "max_depth": 3,
  "start_date": null,
  "end_date": null,
  "parent_id": "new-parent-id"
}
```

**Updatable fields:** `channel`, `label`, `url`, `icon`, `image_url`, `mobile_image_url`, `rich_text`, `include_children`, `max_depth`, `position`, `is_active`, `start_date`, `end_date`, `open_in_new_tab`, `css_class`, `parent_id`

**Clearable string fields:** `label`, `url`, `icon`, `image_url`, `mobile_image_url`, `rich_text`, `css_class` — sending an empty string sets them to `null`.

**Date fields:** `start_date`, `end_date` — send `null` or falsy to clear.

**Moving in hierarchy (`parent_id` change):**
- Validates the new parent exists
- Prevents circular references (cannot move to own descendant)
- Recalculates `level` and `path` for the item and all descendants
- Moving to root: set `parent_id` to `null`

```json
{
  "menuItem": { /* updated IMenuItem document */ }
}
```

### Delete Menu Item

```
DELETE /api/b2b/menu/{menu_item_id}
```

| Param | Type | Required | Description |
|-------|------|:--------:|-------------|
| `delete_children` | boolean | No | `true` to recursively delete all descendants |

**Behavior:**
- If the item has children and `delete_children` is not `true`: returns `400` with error message
- If `delete_children=true`: deletes all descendants first (via `{ path: id }`), then the item

```json
{ "success": true }
```

### Reorder Menu Items

```
POST /api/b2b/menu/reorder
```

Batch update positions and parent assignments for drag-and-drop reordering.

```json
{
  "items": [
    { "menu_item_id": "abc123", "position": 0, "parent_id": null },
    { "menu_item_id": "def456", "position": 1, "parent_id": null },
    { "menu_item_id": "ghi789", "position": 0, "parent_id": "abc123" }
  ]
}
```

**Behavior:**
- Validates all `menu_item_id` values exist
- Bulk-updates positions via `bulkWrite`
- Recalculates `level` and `path` if `parent_id` changed

```json
{
  "success": true,
  "updated": 3
}
```

### Import from External API

```
POST /api/b2b/menu/import
```

Import a menu hierarchy from an external API endpoint. Used for migrating menus from legacy systems.

```json
{
  "location": "header",
  "externalUrl": "https://api.legacy-system.com/menu",
  "clearExisting": false
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `location` | string | Yes | Target location |
| `externalUrl` | string | Yes | URL to fetch menu data from |
| `clearExisting` | boolean | No | Delete all items in the location before importing |

**Expected external API response format:**

```json
{
  "message": [
    {
      "name": "menu-cat-1",
      "label": "Category 1",
      "title": "Category 1",
      "url": "/category-1",
      "description": "Description text",
      "order": 0,
      "parent_menu": null,
      "lft": 1,
      "rgt": 10,
      "is_group": 1,
      "category_menu_image": "https://cdn.com/icon.png",
      "category_banner_image": "https://cdn.com/banner.jpg",
      "category_banner_image_mobile": "https://cdn.com/banner-mobile.jpg",
      "disable": 0
    }
  ]
}
```

**Field mapping:**

| External Field | MenuItem Field | Notes |
|----------------|---------------|-------|
| `name` | `reference_id` | External ID, used for upsert matching |
| `label` / `title` | `label` | Label takes precedence |
| `url` | `url` | |
| `description` | `rich_text` | |
| `order` | `position` | |
| `parent_menu` | `parent_id` | Resolved to internal IDs |
| `is_group` | `include_children` | `1` = true |
| `category_menu_image` | `icon` | |
| `category_banner_image` | `image_url` | Desktop banner |
| `category_banner_image_mobile` | `mobile_image_url` | Mobile banner |
| `disable` | `is_active` | `0` = active |

All imported items are created with `type: "category"`.

**Response:**

```json
{
  "success": true,
  "stats": {
    "total": 42,
    "imported": 38,
    "updated": 4,
    "errors": 0
  },
  "errors": ["Item X: error message"]
}
```

---

## Public API

Base: `/api/public/menu`

Auth: None (uses `x-resolved-tenant-db` header set by middleware)

### Get Menu (Storefront)

```
GET /api/public/menu
```

| Param | Type | Required | Description |
|-------|------|:--------:|-------------|
| `location` | string | No | Filter by location |
| `channel` | string | No | Sales channel (default: `"default"`) |

**Filters applied automatically:**
- `is_active: true`
- Time bounds checked against current server time

**URL resolution:** Entity types are converted to storefront URLs:

| Type | Resolved URL |
|------|-------------|
| `category` | `/search?filters-category_id={reference_id}` |
| `brand` | `/search?filters-brand_id={reference_id}` |
| `collection` | `/search?filters-collection_id={reference_id}` |
| `tag` | `/search?filters-tag_id={reference_id}` |
| `product_type` | `/search?filters-product_type_id={reference_id}` |
| `product` | `/product/{slug}` (slug fetched from PIMProduct) |
| `search` | `/search?text={url}` |
| `url` | As-is (prefixed with `/` if needed) |
| `page` | `url` field value |
| `text` | No URL |
| `divider` | No URL |

**Response:** Both tree and flat representations.

```json
{
  "success": true,
  "menuItems": [
    {
      "id": "TkOehdTBEl1H",
      "type": "category",
      "label": "Prodotti",
      "reference_id": "cat-prodotti",
      "url": "/search?filters-category_id=cat-prodotti",
      "icon": "https://cdn.example.com/icons/prodotti.svg",
      "rich_text": "<p>Scopri i nostri prodotti</p>",
      "image_url": "https://cdn.example.com/banners/prodotti.jpg",
      "mobile_image_url": "https://cdn.example.com/banners/prodotti-mobile.jpg",
      "include_children": true,
      "max_depth": 2,
      "open_in_new_tab": false,
      "css_class": "highlight-menu",
      "level": 0,
      "children": [
        {
          "id": "QvFMnj0c0Mrk",
          "type": "category",
          "label": "Tavola e Servizio",
          "reference_id": "cat-tavola",
          "url": "/search?filters-category_id=cat-tavola",
          "level": 1,
          "children": []
        }
      ]
    }
  ],
  "flat": [ /* raw IMenuItem documents */ ]
}
```

---

## Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `"Location and type are required"` | Missing required fields on create |
| 400 | `"URL is required for type 'url'"` | Type `url` without `url` field |
| 400 | `"reference_id is required for type '{type}'"` | Entity type without `reference_id` |
| 400 | `"Cannot delete menu item with N children..."` | Deleting parent without `delete_children=true` |
| 400 | `"Cannot move item to its own descendant"` | Circular reference on parent change |
| 400 | `"items array is required"` | Missing `items` on reorder |
| 401 | `"Unauthorized"` | No valid session |
| 404 | `"Menu item not found"` | Invalid `menu_item_id` |
| 404 | `"Parent menu item not found"` | Invalid `parent_id` |
| 404 | `"Some menu items not found or unauthorized"` | Invalid IDs in reorder batch |

---

## cURL Examples

### List header menu items

```bash
curl -b cookies.txt \
  'http://localhost:3001/api/b2b/menu?location=header&channel=default'
```

### List all items (including inactive)

```bash
curl -b cookies.txt \
  'http://localhost:3001/api/b2b/menu?location=header&channel=default&include_inactive=true'
```

### Create a category menu item

```bash
curl -b cookies.txt -X POST \
  'http://localhost:3001/api/b2b/menu' \
  -H 'Content-Type: application/json' \
  -d '{
    "location": "header",
    "type": "category",
    "reference_id": "cat-prodotti",
    "label": "Prodotti",
    "include_children": true,
    "max_depth": 2
  }'
```

### Create a child item under an existing parent

```bash
curl -b cookies.txt -X POST \
  'http://localhost:3001/api/b2b/menu' \
  -H 'Content-Type: application/json' \
  -d '{
    "location": "header",
    "type": "brand",
    "reference_id": "brand-flo",
    "label": "Flo SpA",
    "parent_id": "TkOehdTBEl1H"
  }'
```

### Create a custom URL item

```bash
curl -b cookies.txt -X POST \
  'http://localhost:3001/api/b2b/menu' \
  -H 'Content-Type: application/json' \
  -d '{
    "location": "footer",
    "type": "url",
    "label": "Chi Siamo",
    "url": "https://www.example.com/about",
    "open_in_new_tab": true
  }'
```

### Create a time-bound promotional item

```bash
curl -b cookies.txt -X POST \
  'http://localhost:3001/api/b2b/menu' \
  -H 'Content-Type: application/json' \
  -d '{
    "location": "header",
    "type": "search",
    "label": "Black Friday",
    "url": "black friday",
    "start_date": "2025-11-28T00:00:00Z",
    "end_date": "2025-12-01T23:59:59Z",
    "css_class": "promo-highlight"
  }'
```

### Update a menu item

```bash
curl -b cookies.txt -X PATCH \
  'http://localhost:3001/api/b2b/menu/TkOehdTBEl1H' \
  -H 'Content-Type: application/json' \
  -d '{
    "label": "I Nostri Prodotti",
    "is_active": false
  }'
```

### Move an item to a new parent

```bash
curl -b cookies.txt -X PATCH \
  'http://localhost:3001/api/b2b/menu/QvFMnj0c0Mrk' \
  -H 'Content-Type: application/json' \
  -d '{
    "parent_id": "TkOehdTBEl1H"
  }'
```

### Delete a menu item with children

```bash
curl -b cookies.txt -X DELETE \
  'http://localhost:3001/api/b2b/menu/TkOehdTBEl1H?delete_children=true'
```

### Reorder menu items

```bash
curl -b cookies.txt -X POST \
  'http://localhost:3001/api/b2b/menu/reorder' \
  -H 'Content-Type: application/json' \
  -d '{
    "items": [
      { "menu_item_id": "def456", "position": 0, "parent_id": null },
      { "menu_item_id": "abc123", "position": 1, "parent_id": null }
    ]
  }'
```

### Import from external system

```bash
curl -b cookies.txt -X POST \
  'http://localhost:3001/api/b2b/menu/import' \
  -H 'Content-Type: application/json' \
  -d '{
    "location": "header",
    "externalUrl": "https://api.legacy-system.com/menu",
    "clearExisting": true
  }'
```

### Fetch public menu (storefront)

```bash
curl -H 'x-resolved-tenant-db: vinc-acme-it' \
  'http://localhost:3001/api/public/menu?location=header&channel=default'
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/models/menu.ts` | MongoDB schema, `IMenuItem`, `MenuItemType`, `MenuLocation` |
| `src/app/api/b2b/menu/route.ts` | GET (list) and POST (create) |
| `src/app/api/b2b/menu/[id]/route.ts` | GET (single), PATCH (update), DELETE |
| `src/app/api/b2b/menu/reorder/route.ts` | POST (batch reorder) |
| `src/app/api/b2b/menu/import/route.ts` | POST (import from external API) |
| `src/app/api/public/menu/route.ts` | GET (public, tree + flat, URL resolution) |
| `src/app/b2b/(protected)/pim/menu-settings/page.tsx` | Admin UI page |
| `src/components/menu/menu-builder.tsx` | Drag-and-drop menu builder (dnd-kit) |
| `src/components/menu/menu-item-form.tsx` | Create/edit modal form |
| `src/components/menu/menu-item-row.tsx` | Tree row with actions |
| `src/components/menu/entity-selector.tsx` | Entity picker for reference types |

---

## Important Notes

1. **Multi-tenant isolation.** Each tenant has its own `menuitems` collection in their `vinc-{tenantId}` database. No `wholesaler_id` field — the database boundary provides isolation.

2. **Multi-channel support.** Items are scoped by `channel`. The admin UI includes a channel selector. The same location (e.g., `header`) can have different menus per channel.

3. **Cache invalidation.** Every B2B mutation (create, update, delete, reorder, import) invalidates the B2C Redis cache for the `menu` key. The storefront fetches fresh data on next request.

4. **URL resolution in public API only.** The B2B API returns raw `reference_id` values. The public API resolves entity types to filter URLs (e.g., `category` → `/search?filters-category_id=...`). For `product` type items, slugs are bulk-fetched from `pimproducts` to build `/product/{slug}` URLs.

5. **Time-bound visibility.** Items with `start_date` and/or `end_date` are automatically shown/hidden by the public API based on server time. The B2B admin always sees all items (with `include_inactive=true`).

6. **Circular reference prevention.** When moving an item (`parent_id` change), the API checks that the new parent's `path` does not contain the item's own ID. This prevents infinite loops in the tree.

7. **Descendant path updates.** When a parent changes, all descendants' `path` and `level` fields are recalculated. The query `{ path: itemId }` efficiently finds all descendants at any depth.

8. **Position auto-assignment.** On create, the item is appended after the last sibling (highest `position + 1`). On reorder, positions are explicitly set by the client.
