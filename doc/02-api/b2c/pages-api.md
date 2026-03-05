# B2C Pages API

API for managing custom pages within B2C storefronts. Pages are metadata records; actual content (blocks) is managed via page templates.

## Base URL

```
/api/b2b/b2c/storefronts/{storefrontSlug}/pages
```

## Authentication

All admin endpoints require B2B authentication via `requireTenantAuth`.

| Method    | Headers                                          |
| --------- | ------------------------------------------------ |
| Session   | Cookie-based                                     |
| API Key   | `x-auth-method`, `x-api-key-id`, `x-api-secret` |
| JWT Token | `Authorization: Bearer <token>`                  |

---

## Page Management

### List Pages

Returns all pages for a storefront with template status info (draft/published, timestamps).

**Endpoint:** `GET /api/b2b/b2c/storefronts/{slug}/pages`

**Query Parameters:**

| Param    | Type   | Default | Description               |
| -------- | ------ | ------- | ------------------------- |
| `page`   | number | 1       | Page number               |
| `limit`  | number | 50      | Items per page (max 50)   |
| `status` | string | —       | Filter by `active`/`inactive` |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "...",
        "storefront_slug": "simani",
        "slug": "chi-siamo",
        "title": "Chi siamo",
        "status": "active",
        "show_in_nav": true,
        "sort_order": 0,
        "created_at": "2026-03-01T10:00:00.000Z",
        "updated_at": "2026-03-05T08:30:00.000Z",
        "template_status": "published",
        "last_saved_at": "2026-03-05T08:30:00.000Z",
        "published_at": "2026-03-04T14:00:00.000Z",
        "has_unpublished_changes": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

**Enriched template fields:**

| Field                      | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `template_status`          | `"draft"` or `"published"` — content status          |
| `last_saved_at`            | When the template blocks were last saved              |
| `published_at`             | When the template was last published (null if never)  |
| `has_unpublished_changes`  | `true` if template is draft but was published before  |

---

### Create Page

**Endpoint:** `POST /api/b2b/b2c/storefronts/{slug}/pages`

**Body:**

```json
{
  "slug": "about-us",
  "title": "About Us",
  "show_in_nav": true,
  "sort_order": 0
}
```

| Field         | Required | Default | Description                       |
| ------------- | -------- | ------- | --------------------------------- |
| `slug`        | yes      | —       | URL slug (lowercase, `a-z0-9-`)   |
| `title`       | yes      | —       | Display title                     |
| `show_in_nav` | no       | `true`  | Show in storefront navigation     |
| `sort_order`  | no       | `0`     | Sort order for navigation display |

**Response:** `201`

```json
{
  "success": true,
  "data": { "_id": "...", "slug": "about-us", "title": "About Us", ... }
}
```

**Errors:**
- `409` — Page slug already exists for this storefront

---

### Get Page

**Endpoint:** `GET /api/b2b/b2c/storefronts/{slug}/pages/{pageSlug}`

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "storefront_slug": "simani",
    "slug": "chi-siamo",
    "title": "Chi siamo",
    "status": "active",
    "show_in_nav": true,
    "sort_order": 0,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### Update Page

**Endpoint:** `PATCH /api/b2b/b2c/storefronts/{slug}/pages/{pageSlug}`

**Body (all fields optional):**

```json
{
  "title": "About Us (updated)",
  "status": "inactive",
  "show_in_nav": false,
  "sort_order": 5
}
```

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

---

### Delete Page

Deletes the page, its template (blocks), and all form submissions.

**Endpoint:** `DELETE /api/b2b/b2c/storefronts/{slug}/pages/{pageSlug}`

**Response:**

```json
{
  "success": true
}
```

---

## Page Template (Content)

Templates store the actual page content (blocks, SEO). Each page has one template document with a draft/published workflow.

### Get Template

Returns the full template config for the page builder.

**Endpoint:** `GET /api/b2b/b2c/storefronts/{slug}/pages/{pageSlug}/template`

**Response:**

```json
{
  "slug": "b2c-simani-page-chi-siamo",
  "name": "Chi siamo",
  "versions": [
    {
      "version": 1,
      "blocks": [ ... ],
      "seo": { ... },
      "status": "published",
      "label": "Version 1",
      "createdAt": "...",
      "lastSavedAt": "...",
      "publishedAt": "...",
      "createdBy": "b2b-admin",
      "comment": "..."
    }
  ],
  "currentVersion": 1,
  "currentPublishedVersion": 1,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### Save Draft

Saves blocks and SEO as a draft. Sets template status to `"draft"`.

**Endpoint:** `POST /api/b2b/b2c/storefronts/{slug}/pages/{pageSlug}/template/save-draft`

**Body:**

```json
{
  "blocks": [
    {
      "id": "block-0",
      "type": "custom_html",
      "config": { "html": "<h1>Hello</h1>" },
      "metadata": {},
      "layout": null
    }
  ],
  "seo": {
    "title": "Chi siamo",
    "description": "About our company"
  }
}
```

| Field    | Required | Description                  |
| -------- | -------- | ---------------------------- |
| `blocks` | yes      | Array of block objects       |
| `seo`    | no       | SEO metadata (title, desc)   |

**Response:** Same as Get Template (updated config)

---

### Publish

Sets template status to `"published"` and records `publishedAt`. Also sends a Redis cache invalidation event for B2C frontends.

**Endpoint:** `POST /api/b2b/b2c/storefronts/{slug}/pages/{pageSlug}/template/publish`

**Body:** none

**Response:** Same as Get Template (updated config)

---

## Public API (B2C Frontend)

These endpoints are used by the B2C storefront frontend to fetch published page data. Authentication is via API key + Origin header (domain matching).

### List Navigation Pages

Returns active pages with `show_in_nav: true` for storefront navigation.

**Endpoint:** `GET /api/b2b/b2c/public/pages`

**Headers:**

| Header         | Required | Description                      |
| -------------- | -------- | -------------------------------- |
| `x-api-key-id` | yes      | API key ID                       |
| `x-api-secret`  | yes      | API key secret                   |
| `Origin`       | yes      | Storefront domain (for matching) |

**Response:**

```json
{
  "pages": [
    { "slug": "chi-siamo", "title": "Chi siamo", "sort_order": 0 },
    { "slug": "contatti", "title": "Contatti", "sort_order": 1 }
  ]
}
```

---

### Get Published Page Content

Returns published blocks and SEO for a specific page.

**Endpoint:** `GET /api/b2b/b2c/public/pages/{pageSlug}`

**Headers:** Same as List Navigation Pages

**Response:**

```json
{
  "blocks": [ ... ],
  "seo": { "title": "Chi siamo", "description": "..." },
  "version": 1,
  "publishedAt": "2026-03-04T14:00:00.000Z"
}
```

**Errors:**
- `404` — Page not found or not published

---

## Data Model

### B2CPage (collection: `b2cpages`)

Page metadata — does **not** contain content.

| Field             | Type    | Description                    |
| ----------------- | ------- | ------------------------------ |
| `storefront_slug` | string  | Storefront this page belongs to|
| `slug`            | string  | URL slug (`a-z0-9-`)          |
| `title`           | string  | Display title                  |
| `status`          | string  | `active` / `inactive`         |
| `show_in_nav`     | boolean | Show in storefront navigation  |
| `sort_order`      | number  | Navigation sort order          |
| `created_at`      | date    | Creation timestamp             |
| `updated_at`      | date    | Last metadata update           |

**Indexes:**
- `{ storefront_slug, slug }` — unique
- `{ storefront_slug, sort_order }`

### Page Template (collection: `b2bhometemplates`)

Content is stored in the shared HomeTemplate collection, scoped by `templateId: "b2c-{storefront}-page-{slug}"`.

| Field          | Type   | Description                         |
| -------------- | ------ | ----------------------------------- |
| `templateId`   | string | `b2c-{storefront}-page-{slug}`      |
| `status`       | string | `draft` / `published`               |
| `blocks`       | array  | Page content blocks                 |
| `seo`          | object | SEO metadata                        |
| `lastSavedAt`  | string | Last draft save timestamp           |
| `publishedAt`  | string | Last publish timestamp (null=never) |
| `version`      | number | Version number                      |

---

## Workflow

1. **Create page** → `POST .../pages` — creates metadata + empty template (draft)
2. **Edit content** → Use the Page Builder UI, saves via `POST .../template/save-draft`
3. **Publish** → `POST .../template/publish` — makes content live, sets `publishedAt`
4. **Edit again** → Saving sets status back to `draft` (content is `has_unpublished_changes`)
5. **Re-publish** → Updates `publishedAt`, status back to `published`
