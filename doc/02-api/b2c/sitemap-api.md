# B2C Sitemap & Robots API

API for managing sitemap data and robots.txt configuration for B2C storefronts. The commerce suite collects and stores structured URL data; the B2C frontend (vinc-storefront) uses this data to generate the actual `sitemap.xml` and `robots.txt` files.

## Architecture

```
Commerce Suite (this API)          B2C Frontend (vinc-storefront)
┌──────────────────────┐           ┌──────────────────────┐
│ Collect URLs         │           │ GET /sitemap-data    │
│ (products, pages,    │──JSON──▶  │ Build sitemap.xml    │
│  categories)         │           │ Build robots.txt     │
│                      │           │ Serve to crawlers    │
│ Redis pub/sub notify │──event──▶ │ Regenerate on change │
└──────────────────────┘           └──────────────────────┘
```

**Redis notification channel:** `vinc-b2c:cache-invalidate:{storefrontSlug}` with payload `"sitemap"`.
The B2C frontend should listen on this channel (same as existing cache invalidation) and regenerate its sitemap/robots files when it receives a `"sitemap"` message.

---

## Authentication

### Admin Endpoints

Require B2B authentication via `requireTenantAuth`.

| Method    | Headers                                          |
| --------- | ------------------------------------------------ |
| Session   | Cookie-based                                     |
| API Key   | `x-auth-method`, `x-api-key-id`, `x-api-secret` |
| JWT Token | `Authorization: Bearer <token>`                  |

### Public Endpoints

Require API key + Origin header (same as `/api/b2b/b2c/public/home`).

| Header         | Value                        |
| -------------- | ---------------------------- |
| `x-api-key-id` | `ak_{tenant}_{key}`          |
| `x-api-secret` | `sk_{secret}`                |
| `Origin`       | `https://shop.example.com`   |

---

## Admin API

### Get Sitemap Status

Returns sitemap stats, robots configuration, and validation results.

**Endpoint:** `GET /api/b2b/b2c/storefronts/{slug}/sitemap`

**Response:**

```json
{
  "success": true,
  "data": {
    "generated": true,
    "stats": {
      "total_urls": 423,
      "homepage_urls": 1,
      "page_urls": 1,
      "product_urls": 352,
      "category_urls": 69,
      "locales": ["it"],
      "last_generated_at": "2026-03-10T08:09:12.864Z",
      "generation_duration_ms": 1149
    },
    "robots_config": {
      "custom_rules": "",
      "disallow": ["/admin/", "/api/", "/preview/", "/cart/", "/orders/"]
    },
    "validation": {
      "warnings": [],
      "errors": [],
      "last_validated_at": "2026-03-10T08:09:12.864Z"
    },
    "url_count": 423
  }
}
```

If no sitemap has been generated yet, `generated` is `false` and `stats`/`validation` are `null`.

---

### Regenerate Sitemap

Triggers immediate sitemap regeneration. Collects all URLs (homepage, pages, products, categories), saves to DB, and notifies the B2C frontend via Redis.

**Endpoint:** `POST /api/b2b/b2c/storefronts/{slug}/sitemap`

**Body:**

```json
{ "action": "regenerate" }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "stats": {
      "total_urls": 423,
      "homepage_urls": 1,
      "page_urls": 1,
      "product_urls": 352,
      "category_urls": 69,
      "locales": ["it"],
      "last_generated_at": "2026-03-10T08:24:21.748Z",
      "generation_duration_ms": 1730
    },
    "validation": {
      "warnings": [],
      "errors": [],
      "last_validated_at": "2026-03-10T08:24:21.748Z"
    },
    "url_count": 423
  }
}
```

---

### Run Validation

Runs validation checks without regenerating URLs.

**Endpoint:** `POST /api/b2b/b2c/storefronts/{slug}/sitemap`

**Body:**

```json
{ "action": "validate" }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "warnings": ["No active custom pages — consider adding pages for better SEO"],
    "errors": [],
    "last_validated_at": "2026-03-10T09:00:00.000Z"
  }
}
```

**Validation checks:**

| Severity | Check |
| -------- | ----- |
| Error    | No primary domain configured |
| Error    | Storefront is inactive |
| Warning  | No published products in channel |
| Warning  | No active custom pages |
| Warning  | robots meta tag is `noindex` but sitemap has URLs (contradiction) |
| Warning  | Sitemap exceeds 50,000 URLs (frontend should split into multiple files) |

---

### Update Custom Robots Rules

Updates the custom rules appended to the auto-generated robots.txt.

**Endpoint:** `POST /api/b2b/b2c/storefronts/{slug}/sitemap`

**Body:**

```json
{
  "action": "update_robots_rules",
  "custom_rules": "User-agent: Googlebot\nAllow: /special-page/"
}
```

**Response:**

```json
{ "success": true }
```

---

## Public API

### Get Sitemap Data

Returns structured JSON data for the B2C frontend to build `sitemap.xml` and `robots.txt`.

**Endpoint:** `GET /api/b2b/b2c/public/sitemap-data`

**Response:**

```json
{
  "urls": [
    {
      "path": "/it",
      "type": "homepage",
      "lastmod": "2026-03-10T08:09:12.312Z",
      "changefreq": "daily",
      "priority": 1,
      "alternates": { "it": "/it" }
    },
    {
      "path": "/it/portfolio/contatti",
      "type": "page",
      "lastmod": "2026-03-09T10:10:31.796Z",
      "changefreq": "weekly",
      "priority": 0.6,
      "alternates": { "it": "/it/portfolio/contatti" }
    },
    {
      "path": "/it/products/250-pz-cannucce-in-pla-page0815sbpla",
      "type": "product",
      "lastmod": "2026-03-08T13:24:37.445Z",
      "changefreq": "daily",
      "priority": 0.8,
      "alternates": { "it": "/it/products/250-pz-cannucce-in-pla-page0815sbpla" }
    },
    {
      "path": "/it/prodotti/tavola-e-servizio/bicchieri-e-bevande",
      "type": "category",
      "lastmod": "2026-03-09T14:47:30.024Z",
      "changefreq": "weekly",
      "priority": 0.7,
      "alternates": { "it": "/it/prodotti/tavola-e-servizio/bicchieri-e-bevande" }
    }
  ],
  "robots_config": {
    "custom_rules": "",
    "disallow": ["/admin/", "/api/", "/preview/", "/cart/", "/orders/"]
  },
  "stats": {
    "total_urls": 423,
    "homepage_urls": 1,
    "page_urls": 1,
    "product_urls": 352,
    "category_urls": 69,
    "locales": ["it"],
    "last_generated_at": "2026-03-10T08:09:12.864Z",
    "generation_duration_ms": 1149
  },
  "storefront": {
    "slug": "simani",
    "primary_domain": "http://localhost:3000"
  }
}
```

---

## URL Types & Patterns

| Type       | Source                                                   | URL Pattern                                              | Priority | Changefreq |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------- | -------- | ---------- |
| `homepage` | Storefront                                               | `/{locale}/`                                             | 1.0      | daily      |
| `page`     | `B2CPage` (status: active)                               | `/{locale}/portfolio/{pageSlug}`                         | 0.6      | weekly     |
| `product`  | `PIMProduct` (status: published, channels includes channel) | `/{locale}/products/{slug or sku}`                       | 0.8      | daily      |
| `category` | `Category` (active, in channel tree)                     | `/{locale}/{root-slug}/{parent-slug}/.../{category-slug}` | 0.7      | weekly     |

**Products:** Uses the locale-specific slug from `product.slug[locale]`, falls back to `product.sku`.

**Categories:** Builds hierarchical URLs from the category tree. The root category slug (e.g., `prodotti`) comes from the database, not hardcoded. Example: `/it/prodotti/contenitori-e-asporto/contenitori-e-coperchi/contenitori`.

**Hreflang alternates:** Each URL includes an `alternates` object mapping locale codes to their locale-specific paths. When multiple locales are enabled, the B2C frontend should emit `<xhtml:link rel="alternate" hrefLang="{locale}" href="{full-url}" />` tags inside each `<url>` entry. Only parent `<url>` tags count toward the 50,000-per-sitemap-file limit.

---

## Automatic Regeneration Triggers

Sitemap data is automatically regenerated (with 30-second debounce) when:

| Event | Service |
| ----- | ------- |
| Page created | `b2c-page.service.ts → createPage()` |
| Page updated (slug or status change) | `b2c-page.service.ts → updatePage()` |
| Page deleted | `b2c-page.service.ts → deletePage()` |
| Page duplicated | `b2c-page.service.ts → duplicatePage()` |
| Storefront domains changed | `b2c-storefront.service.ts → updateStorefront()` |
| Storefront status changed | `b2c-storefront.service.ts → updateStorefront()` |
| Storefront channel changed | `b2c-storefront.service.ts → updateStorefront()` |
| Storefront default language changed | `b2c-storefront.service.ts → updateStorefront()` |

After regeneration, a Redis pub/sub message is published to `vinc-b2c:cache-invalidate:{storefrontSlug}` with payload `"sitemap"`.

---

## B2C Frontend Integration Guide

### 1. Fetch sitemap data

```typescript
const res = await fetch(`${COMMERCE_SUITE_URL}/api/b2b/b2c/public/sitemap-data`, {
  headers: {
    "x-api-key-id": API_KEY_ID,
    "x-api-secret": API_SECRET,
    "Origin": STOREFRONT_DOMAIN,
  },
});
const { urls, robots_config, storefront } = await res.json();
```

### 2. Generate robots.txt

```typescript
function buildRobotsTxt(config, primaryDomain) {
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...config.disallow.map(d => `Disallow: ${d}`),
    "",
    `Sitemap: ${primaryDomain}/sitemap.xml`,
  ];
  if (config.custom_rules) {
    lines.push("", config.custom_rules);
  }
  return lines.join("\n");
}
```

### 3. Generate sitemap.xml

```typescript
function buildSitemapXml(urls, primaryDomain) {
  const xmlUrls = urls.map(u => {
    const alternateLinks = Object.entries(u.alternates || {})
      .map(([lang, path]) =>
        `  <xhtml:link rel="alternate" hrefLang="${lang}" href="${primaryDomain}${path}" />`
      ).join("\n");

    return `<url>
  <loc>${primaryDomain}${u.path}</loc>
  <lastmod>${u.lastmod || new Date().toISOString()}</lastmod>
  <changefreq>${u.changefreq}</changefreq>
  <priority>${u.priority}</priority>
${alternateLinks}
</url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${xmlUrls}
</urlset>`;
}
```

### 4. Splitting large sitemaps

If `urls.length > 50000`, split into multiple sitemap files and generate a sitemap index:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://shop.example.com/sitemap-1.xml</loc>
    <lastmod>2026-03-10T08:09:12.864Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://shop.example.com/sitemap-2.xml</loc>
    <lastmod>2026-03-10T08:09:12.864Z</lastmod>
  </sitemap>
</sitemapindex>
```

### 5. Listen for regeneration events

Subscribe to Redis channel `vinc-b2c:cache-invalidate:{storefrontSlug}`. When the message contains `"sitemap"`, re-fetch from the API and regenerate the XML files.

---

## MongoDB Collection

**Collection:** `b2csitemaps`

**Key fields:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `storefront_slug` | string (unique index) | FK to storefront |
| `urls` | array | Structured URL entries |
| `robots_config.custom_rules` | string | Admin-editable rules |
| `robots_config.disallow` | string[] | Disallowed paths |
| `stats` | object | Generation statistics |
| `validation` | object | Last validation results |

---

## Admin UI

Available at: `/{tenant}/b2b/b2c/storefronts/{slug}?section=sitemap`

The Sitemap section in storefront settings provides:

1. **Status card** — URL count breakdown, generation time, "Regenerate Now" button
2. **robots.txt card** — Auto-generated preview + custom rules editor
3. **Validation card** — Run checks, view errors/warnings
4. **URL preview card** — Browse URLs by type (expandable sections with first 20 entries)
