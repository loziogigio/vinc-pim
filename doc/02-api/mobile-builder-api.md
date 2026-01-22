# Mobile Builder API Reference

API endpoints for managing the Mobile Home Builder configuration.

## Base Configuration

```
Base URL: https://cs.vendereincloud.it
Content-Type: application/json
```

### Authentication

All endpoints support two authentication methods:

**1. B2B Session (for admin UI):**
- Uses HTTP-only session cookie set after B2B login
- No additional headers required

**2. API Key (for external integrations):**
```
x-auth-method: api-key
x-api-key-id: ak_{tenant-id}_{key-suffix}
x-api-secret: sk_{secret}
```

---

## 1. Configuration Management

### 1.1 Get Current Config

```http
GET /api/b2b/mobile-builder/config
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `version` | number | Get specific version (optional) |
| `status` | string | Filter by status: `draft` or `published` (optional) |

**Response (200 OK):**
```json
{
  "config": {
    "_id": "679123abc...",
    "config_id": "mobile-home",
    "app_identity": {
      "app_name": "My Store",
      "logo_url": "https://example.com/logo.png",
      "primary_color": "#3b82f6"
    },
    "blocks": [
      {
        "id": "block-1",
        "type": "mobile_media_slider",
        "visibility": "all",
        "settings": {
          "autoplay": true,
          "autoplay_interval": 5000,
          "show_dots": true,
          "show_arrows": false,
          "aspect_ratio": "16:9"
        },
        "items": [
          {
            "media_url": "https://example.com/banner1.jpg",
            "media_type": "image",
            "link_url": "/products",
            "alt_text": "Sale Banner"
          }
        ]
      },
      {
        "id": "block-2",
        "type": "mobile_product_slider",
        "visibility": "all",
        "settings": {
          "title": "Featured Products",
          "show_title": true,
          "items_visible": 2,
          "show_price": true,
          "show_add_to_cart": true,
          "source": "search"
        },
        "search_query": "piscine",
        "limit": 10
      }
    ],
    "version": 1,
    "status": "draft",
    "is_current": true,
    "is_current_published": false,
    "created_at": "2024-01-22T10:00:00.000Z",
    "updated_at": "2024-01-22T12:30:00.000Z"
  },
  "exists": true
}
```

**Response when no config exists (200 OK):**
```json
{
  "config": {
    "config_id": "mobile-home",
    "app_identity": {
      "app_name": "",
      "logo_url": "",
      "primary_color": "#ec4899"
    },
    "blocks": [],
    "version": 1,
    "status": "draft",
    "is_current": true,
    "is_current_published": false
  },
  "exists": false
}
```

---

### 1.2 Save Draft

Saves changes to the current version (updates in place, does NOT create a new version).

```http
POST /api/b2b/mobile-builder/config
```

**Request Body:**
```json
{
  "blocks": [
    {
      "id": "block-1",
      "type": "mobile_media_slider",
      "visibility": "all",
      "settings": {
        "autoplay": true,
        "autoplay_interval": 5000,
        "show_dots": true,
        "show_arrows": false,
        "aspect_ratio": "16:9"
      },
      "items": []
    }
  ],
  "app_identity": {
    "app_name": "My Store",
    "logo_url": "https://example.com/logo.png",
    "primary_color": "#3b82f6"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "config": {
    "_id": "679123abc...",
    "config_id": "mobile-home",
    "version": 1,
    "status": "draft",
    "blocks": [...],
    "app_identity": {...}
  },
  "message": "Draft saved (version 1)"
}
```

---

### 1.3 Publish Config

Publishes the current draft, making it live.

```http
POST /api/b2b/mobile-builder/config/publish
```

**Response (200 OK):**
```json
{
  "success": true,
  "config": {
    "_id": "679123abc...",
    "version": 1,
    "status": "published",
    "is_current": true,
    "is_current_published": true,
    "published_at": "2024-01-22T14:00:00.000Z"
  },
  "message": "Published version 1"
}
```

**Response (404 Not Found):**
```json
{
  "error": "No draft to publish"
}
```

---

## 2. Version Management

### 2.1 List All Versions

```http
GET /api/b2b/mobile-builder/config/versions
```

**Response (200 OK):**
```json
{
  "versions": [
    {
      "version": 3,
      "status": "draft",
      "is_current": true,
      "is_current_published": false,
      "created_at": "2024-01-22T14:00:00.000Z",
      "updated_at": "2024-01-22T15:30:00.000Z"
    },
    {
      "version": 2,
      "status": "published",
      "is_current": false,
      "is_current_published": true,
      "created_at": "2024-01-21T10:00:00.000Z",
      "updated_at": "2024-01-21T12:00:00.000Z"
    },
    {
      "version": 1,
      "status": "published",
      "is_current": false,
      "is_current_published": false,
      "created_at": "2024-01-20T08:00:00.000Z",
      "updated_at": "2024-01-20T09:00:00.000Z"
    }
  ],
  "total": 3
}
```

---

### 2.2 Create New Version

Creates a new version by duplicating an existing version.

```http
POST /api/b2b/mobile-builder/config/versions
```

**Request Body:**
```json
{
  "from_version": 2
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `from_version` | number | Version to duplicate (optional, defaults to current) |

**Response (200 OK):**
```json
{
  "success": true,
  "config": {
    "_id": "679456def...",
    "version": 4,
    "status": "draft",
    "is_current": true,
    "is_current_published": false,
    "blocks": [...],
    "app_identity": {...}
  },
  "message": "New version 4 created"
}
```

---

### 2.3 Switch Version

Makes a different version the current working version.

```http
PATCH /api/b2b/mobile-builder/config/versions
```

**Request Body:**
```json
{
  "version": 2
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "config": {
    "_id": "679234bcd...",
    "version": 2,
    "is_current": true,
    "blocks": [...],
    "app_identity": {...}
  },
  "message": "Switched to version 2"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Version 99 not found"
}
```

---

## 3. Block Types

### 3.1 Media Slider

Horizontal carousel for images/videos.

```json
{
  "id": "unique-id",
  "type": "mobile_media_slider",
  "visibility": "all",
  "settings": {
    "autoplay": true,
    "autoplay_interval": 5000,
    "show_dots": true,
    "show_arrows": false,
    "aspect_ratio": "16:9"
  },
  "items": [
    {
      "media_url": "https://example.com/image.jpg",
      "media_type": "image",
      "link_url": "/products",
      "alt_text": "Banner description"
    }
  ]
}
```

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `autoplay` | boolean | `true` | - |
| `autoplay_interval` | number | `5000` | milliseconds |
| `show_dots` | boolean | `true` | - |
| `show_arrows` | boolean | `false` | - |
| `aspect_ratio` | string | `"16:9"` | `"16:9"`, `"4:3"`, `"1:1"`, `"9:16"` |

---

### 3.2 Product Slider

Horizontal scrollable product cards.

```json
{
  "id": "unique-id",
  "type": "mobile_product_slider",
  "visibility": "all",
  "settings": {
    "title": "Featured Products",
    "show_title": true,
    "items_visible": 2,
    "show_price": true,
    "show_add_to_cart": true,
    "source": "search"
  },
  "search_query": "piscine",
  "limit": 10
}
```

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `title` | string | `"Featured Products"` | - |
| `show_title` | boolean | `true` | - |
| `items_visible` | number | `2` | `2` or `3` |
| `show_price` | boolean | `true` | - |
| `show_add_to_cart` | boolean | `false` | - |
| `source` | string | `"search"` | `"search"` |

---

### 3.3 Media Gallery

Grid layout for images/videos.

```json
{
  "id": "unique-id",
  "type": "mobile_media_gallery",
  "visibility": "all",
  "settings": {
    "columns": 2,
    "gap": "sm"
  },
  "items": [
    {
      "media_url": "https://example.com/image.jpg",
      "media_type": "image",
      "title": "Category 1",
      "link_url": "/category/1"
    }
  ]
}
```

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `columns` | number | `2` | `2` or `3` |
| `gap` | string | `"sm"` | `"none"`, `"sm"`, `"md"` |

---

### 3.4 Product Gallery

Grid layout for product cards.

```json
{
  "id": "unique-id",
  "type": "mobile_product_gallery",
  "visibility": "all",
  "settings": {
    "title": "Products",
    "show_title": true,
    "columns": 2,
    "gap": "sm",
    "show_price": true,
    "show_add_to_cart": true,
    "card_style": "compact",
    "source": "search"
  },
  "search_query": "accessori",
  "limit": 12
}
```

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `title` | string | `"Products"` | - |
| `show_title` | boolean | `true` | - |
| `columns` | number | `2` | `2` or `3` |
| `gap` | string | `"sm"` | `"sm"`, `"md"` |
| `show_price` | boolean | `true` | - |
| `show_add_to_cart` | boolean | `true` | - |
| `card_style` | string | `"compact"` | `"compact"`, `"detailed"` |
| `source` | string | `"search"` | `"search"` |

---

## 4. Block Visibility

All blocks support visibility control:

| Value | Description |
|-------|-------------|
| `"all"` | Visible to everyone (default) |
| `"logged_in_only"` | Only visible to logged-in users |

---

## 5. App Identity

Configure app branding displayed at the top of the mobile home.

```json
{
  "app_identity": {
    "app_name": "My Store",
    "logo_url": "https://example.com/logo.png",
    "primary_color": "#3b82f6"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `app_name` | string | `""` | App name displayed in header |
| `logo_url` | string | `""` | URL to the logo image |
| `primary_color` | string | `"#ec4899"` | Hex color for buttons and accent elements |

### Primary Color Usage

The `primary_color` is applied to:

- "Add to Cart" button background in Product Slider and Product Gallery blocks
- "See All" link text in Product Slider blocks
- Any accent elements defined by the mobile app theme

---

## 6. Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid authentication)
- `404` - Not Found (version or config not found)
- `500` - Internal Server Error
