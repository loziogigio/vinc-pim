# Public API Endpoints

Public endpoints are accessible without authentication and are intended for storefront consumption.

## Base URL

```
/api/public
```

---

## Menu API

### Get Menu Items

Retrieves navigation menu items for storefront rendering.

**Endpoint:** `GET /api/public/menu`

**Authentication:** Not required

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | `string` | No | Filter by menu location: `header`, `footer`, or `mobile` |

### Response

```typescript
{
  success: boolean;
  menuItems: MenuTreeItem[];  // Hierarchical tree structure
  flat: MenuItem[];           // Flat list for flexibility
}
```

### MenuTreeItem Interface

```typescript
interface MenuTreeItem {
  id: string;
  type: "collection" | "category" | "brand" | "tag" | "product_type" | "product" | "page" | "url" | "search" | "divider";
  label: string;
  reference_id?: string;
  url?: string;
  icon?: string;              // Custom icon/image URL
  rich_text?: string;         // HTML content (for search type)
  image_url?: string;         // Desktop promotional image
  mobile_image_url?: string;  // Mobile promotional image
  include_children: boolean;
  max_depth?: number;
  open_in_new_tab: boolean;
  css_class?: string;
  level: number;
  children: MenuTreeItem[];   // Nested children
}
```

### Examples

#### Get all menus

```bash
curl "http://localhost:3001/api/public/menu"
```

#### Get header menu only

```bash
curl "http://localhost:3001/api/public/menu?location=header"
```

#### Get footer menu only

```bash
curl "http://localhost:3001/api/public/menu?location=footer"
```

#### Get mobile menu only

```bash
curl "http://localhost:3001/api/public/menu?location=mobile"
```

### Example Response

```json
{
  "success": true,
  "menuItems": [
    {
      "id": "abc123",
      "type": "category",
      "label": "Electronics",
      "reference_id": "electronics",
      "url": "/category/electronics",
      "icon": "https://cdn.example.com/icons/electronics.png",
      "include_children": true,
      "max_depth": 2,
      "open_in_new_tab": false,
      "level": 0,
      "children": [
        {
          "id": "def456",
          "type": "category",
          "label": "Smartphones",
          "reference_id": "smartphones",
          "url": "/category/smartphones",
          "include_children": false,
          "open_in_new_tab": false,
          "level": 1,
          "children": []
        }
      ]
    }
  ],
  "flat": [
    // ... flat array of all items
  ]
}
```

### Features

- **Active Filtering**: Only returns menu items where `is_active: true`
- **Time-bound Visibility**: Respects `start_date` and `end_date` for seasonal/promotional menus
- **Hierarchical Structure**: Returns nested tree structure with `children` arrays
- **Flat List**: Also provides flat list for alternative rendering approaches
- **Custom Icons**: Supports custom icon/image URLs for each menu item

---

## How to Use the Menu API

### 1. Rendering a Header Navigation

Use the `menuItems` array (hierarchical) to render nested dropdowns:

```tsx
// React/Next.js example
function HeaderNav() {
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    fetch('/api/public/menu?location=header')
      .then(res => res.json())
      .then(data => setMenu(data.menuItems));
  }, []);

  return (
    <nav>
      {menu.map(item => (
        <NavItem key={item.id} item={item} />
      ))}
    </nav>
  );
}

function NavItem({ item }) {
  return (
    <div className="nav-item">
      {/* Show custom icon if available */}
      {item.icon && <img src={item.icon} alt="" className="menu-icon" />}

      {/* Link or text */}
      {item.url ? (
        <a
          href={item.url}
          target={item.open_in_new_tab ? '_blank' : '_self'}
          className={item.css_class}
        >
          {item.label}
        </a>
      ) : (
        <span>{item.label}</span>
      )}

      {/* Nested children (dropdown) */}
      {item.children?.length > 0 && (
        <div className="dropdown">
          {item.children.map(child => (
            <NavItem key={child.id} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 2. Handling "Search" Type Menu Items

The `search` type is special - it can include rich promotional content:

```tsx
function SearchMenuItem({ item }) {
  if (item.type !== 'search') return null;

  return (
    <div className="promo-menu-item">
      {/* Desktop promotional image */}
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.label}
          className="hidden md:block"
        />
      )}

      {/* Mobile promotional image */}
      {item.mobile_image_url && (
        <img
          src={item.mobile_image_url}
          alt={item.label}
          className="block md:hidden"
        />
      )}

      {/* Rich text content (HTML) */}
      {item.rich_text && (
        <div dangerouslySetInnerHTML={{ __html: item.rich_text }} />
      )}

      <a href={item.url}>{item.label}</a>
    </div>
  );
}
```

### 3. Building URLs from Reference IDs

For entity types (category, brand, collection, etc.), use the `reference_id` to build URLs:

```tsx
function buildUrl(item) {
  // If URL is provided, use it directly
  if (item.url) return item.url;

  // Build URL based on type and reference_id
  switch (item.type) {
    case 'category':
      return `/shop?category=${item.reference_id}`;
    case 'brand':
      return `/shop?brand=${item.reference_id}`;
    case 'collection':
      return `/collections/${item.reference_id}`;
    case 'product':
      return `/products/${item.reference_id}`;
    case 'page':
      return `/pages/${item.reference_id}`;
    default:
      return '#';
  }
}
```

### 4. Respecting `include_children` and `max_depth`

These fields are hints for how to render the menu:

```tsx
function shouldShowChildren(item) {
  // Only show children if include_children is true
  if (!item.include_children) return false;

  // If max_depth is set, check current level
  if (item.max_depth && item.level >= item.max_depth - 1) {
    return false;
  }

  return item.children?.length > 0;
}
```

### 5. Handling Dividers

Dividers are visual separators:

```tsx
function MenuItem({ item }) {
  if (item.type === 'divider') {
    return <hr className="menu-divider" />;
  }

  // ... render normal item
}
```

### 6. Using the Flat List

The `flat` array is useful for:
- Breadcrumb generation
- Search indexing
- Sitemap generation

```tsx
// Find all items of a specific type
const allCategories = data.flat.filter(item => item.type === 'category');

// Find item by reference_id
const brand = data.flat.find(item =>
  item.type === 'brand' && item.reference_id === 'nike'
);
```

---

### Menu Item Types

| Type | Description |
|------|-------------|
| `collection` | Link to a product collection |
| `category` | Link to a product category |
| `brand` | Link to a brand page |
| `tag` | Link to a tag filter |
| `product_type` | Link to a product type |
| `product` | Link to a specific product |
| `page` | Link to a CMS page |
| `url` | External or custom URL |
| `search` | Search with rich content (can include promotional images/text) |
| `divider` | Visual separator between menu items |

---

## Error Responses

All public endpoints return errors in this format:

```json
{
  "error": "Error description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad request (invalid parameters) |
| `500` | Internal server error |
