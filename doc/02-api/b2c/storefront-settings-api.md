# B2C Storefront Settings API

API for managing B2C storefront configuration: general settings, branding, header, footer, and SEO meta tags.

## Base URL

```
/api/b2b/b2c/storefronts/{slug}
```

## Authentication

All endpoints require B2B authentication via `requireTenantAuth`.

| Method    | Headers                                          |
| --------- | ------------------------------------------------ |
| Session   | Cookie-based                                     |
| API Key   | `x-auth-method`, `x-api-key-id`, `x-api-secret` |
| JWT Token | `Authorization: Bearer <token>`                  |

---

## Get Storefront

**Endpoint:** `GET /api/b2b/b2c/storefronts/{slug}`

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "simani",
    "slug": "simani",
    "channel": "b2c",
    "domains": [
      { "domain": "https://simani-b2c.vendereincloud.it", "is_primary": true },
      { "domain": "http://localhost:3000", "is_primary": false }
    ],
    "status": "active",
    "branding": { ... },
    "header_config": { ... },
    "header_config_draft": { ... },
    "footer": { ... },
    "footer_draft": { ... },
    "meta_tags": { ... },
    "settings": { "default_language": "it" },
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-03-06T14:30:00.000Z"
  }
}
```

---

## Update Storefront

Single PATCH endpoint handles all sections. Send only the fields you want to update.

**Endpoint:** `PATCH /api/b2b/b2c/storefronts/{slug}`

**Response:** `{ success: true, data: IB2CStorefront }`

---

## Section: General

Settings for name, channel, domains, status, and default language.

**Body:**

```json
{
  "name": "My Store",
  "channel": "b2c",
  "domains": [
    { "domain": "https://shop.example.com", "is_primary": true },
    { "domain": "http://localhost:3000", "is_primary": false }
  ],
  "status": "active",
  "settings": {
    "default_language": "it"
  }
}
```

| Field                       | Type     | Description                              |
| --------------------------- | -------- | ---------------------------------------- |
| `name`                      | string   | Storefront display name                  |
| `channel`                   | string   | Sales channel code (unique per tenant)   |
| `domains`                   | array    | List of domain entries                   |
| `domains[].domain`          | string   | Full domain URL (e.g. `https://shop.example.com`) |
| `domains[].is_primary`      | boolean  | Primary domain (used in email links). Only one allowed |
| `status`                    | string   | `active` or `inactive`                   |
| `settings.default_language` | string   | ISO language code (e.g. `it`, `en`)      |

**Domain validation:**
- Normalized to lowercase
- At most one primary domain per storefront
- Duplicate domains across storefronts are rejected

---

## Section: Branding

Visual identity: logo, favicon, colors, font.

**Body:**

```json
{
  "branding": {
    "title": "Simani Industrie",
    "logo_url": "https://cdn.example.com/logo.svg",
    "favicon_url": "https://cdn.example.com/favicon.ico",
    "primary_color": "#009688",
    "secondary_color": "#00796b",
    "accent_color": "#ff5722",
    "font_family": "Inter"
  }
}
```

| Field                     | Type   | Description                                    |
| ------------------------- | ------ | ---------------------------------------------- |
| `branding.title`          | string | Company title (navigation, browser tab, emails) |
| `branding.logo_url`       | string | Logo image URL (SVG/PNG recommended)           |
| `branding.favicon_url`    | string | Favicon URL (32x32 PNG/ICO)                    |
| `branding.primary_color`  | string | Hex color for buttons, highlights              |
| `branding.secondary_color`| string | Hex color for accents, hover states            |
| `branding.accent_color`   | string | Hex color for badges, alerts                   |
| `branding.font_family`    | string | CSS font family (e.g. `Inter`, `Roboto`)       |

**Note:** Branding changes trigger a Redis cache invalidation event on `vinc-b2c:cache-invalidate:{slug}` so the B2C frontend refreshes.

---

## Section: Header

Row/block/widget builder with draft/publish workflow. The header uses a `HeaderConfig` structure with multiple rows, each containing blocks with widgets.

### Data Structure

```typescript
interface HeaderConfig {
  rows: HeaderRow[];
}

interface HeaderRow {
  id: string;                    // Unique row ID
  enabled: boolean;              // Whether row is visible
  fixed: boolean;                // Sticky/fixed positioning
  backgroundColor?: string;      // Row background color
  textColor?: string;            // Row text color
  layout: RowLayout;             // Block layout preset
  blocks: HeaderBlock[];
}

interface HeaderBlock {
  id: string;
  alignment: "left" | "center" | "right";
  widgets: HeaderWidget[];
}

interface HeaderWidget {
  id: string;
  type: HeaderWidgetType;
  config: Record<string, unknown>;
}
```

### Layout Presets

| Layout      | Blocks | Widths            |
| ----------- | ------ | ----------------- |
| `full`      | 1      | 100%              |
| `50-50`     | 2      | 50% / 50%         |
| `20-60-20`  | 3      | 20% / 60% / 20%   |
| `25-50-25`  | 3      | 25% / 50% / 25%   |
| `30-40-30`  | 3      | 30% / 40% / 30%   |
| `33-33-33`  | 3      | 33% / 33% / 33%   |

### Widget Types

| Type            | Description                    | Multiple? |
| --------------- | ------------------------------ | --------- |
| `logo`          | Company logo                   | No        |
| `search-bar`    | Product search input           | No        |
| `category-menu` | Categories dropdown            | No        |
| `cart`          | Shopping cart icon              | No        |
| `profile`       | User profile / login           | No        |
| `favorites`     | Wishlist icon                  | No        |
| `reminders`     | User reminders                 | No        |
| `notifications` | Push notifications toggle      | No        |
| `compare`       | Product comparison             | No        |
| `company-info`  | Delivery address, balance      | No        |
| `no-price`      | Toggle price visibility        | No        |
| `radio-widget`  | Radio player with stations     | No        |
| `app-launcher`  | App launcher dropdown          | No        |
| `button`        | Custom button/link             | Yes       |
| `spacer`        | Flexible space                 | Yes       |
| `divider`       | Vertical divider               | Yes       |

### Widget Config Examples

**Button:**
```json
{ "label": "CHI SIAMO", "url": "/chi-siamo", "variant": "ghost" }
```
Variants: `primary`, `secondary`, `outline`, `ghost`

**Search Bar:**
```json
{ "placeholder": "Cerca prodotti...", "width": "full" }
```
Width: `sm`, `md`, `lg`, `full`

**Category Menu:**
```json
{ "label": "Categorie" }
```

**Radio Widget:**
```json
{
  "enabled": true,
  "headerIcon": "/assets/radio-icon.png",
  "stations": [
    { "id": "s1", "name": "Station 1", "logoUrl": "...", "streamUrl": "..." }
  ]
}
```

### Save Draft

Saves the current header configuration as a draft without publishing.

**Body:**

```json
{
  "header_config_draft": {
    "rows": [ ... ]
  }
}
```

### Publish Header

Publishes the draft as the live header. Send both fields with the same value.

**Body:**

```json
{
  "header_config": { "rows": [ ... ] },
  "header_config_draft": { "rows": [ ... ] }
}
```

### Default Header Layout

New storefronts start with a classic 3-row layout:

```json
{
  "rows": [
    {
      "id": "row-announcement",
      "enabled": true,
      "fixed": false,
      "backgroundColor": "#009688",
      "textColor": "#ffffff",
      "layout": "full",
      "blocks": [
        {
          "id": "row-announcement-full",
          "alignment": "right",
          "widgets": [
            { "id": "btn-chi-siamo", "type": "button", "config": { "label": "CHI SIAMO", "url": "/chi-siamo", "variant": "ghost" } }
          ]
        }
      ]
    },
    {
      "id": "row-main",
      "enabled": true,
      "fixed": false,
      "backgroundColor": "#ffffff",
      "layout": "20-60-20",
      "blocks": [
        {
          "id": "row-main-left",
          "alignment": "left",
          "widgets": [
            { "id": "widget-logo", "type": "logo", "config": {} }
          ]
        },
        {
          "id": "row-main-center",
          "alignment": "center",
          "widgets": [
            { "id": "widget-search", "type": "search-bar", "config": { "placeholder": "Cerca prodotti...", "width": "full" } }
          ]
        },
        {
          "id": "row-main-right",
          "alignment": "right",
          "widgets": [
            { "id": "widget-profile", "type": "profile", "config": {} },
            { "id": "widget-favorites", "type": "favorites", "config": {} },
            { "id": "widget-reminders", "type": "reminders", "config": {} },
            { "id": "widget-cart", "type": "cart", "config": {} }
          ]
        }
      ]
    },
    {
      "id": "row-categories",
      "enabled": true,
      "fixed": false,
      "backgroundColor": "#f8f9fa",
      "layout": "full",
      "blocks": [
        {
          "id": "row-categories-full",
          "alignment": "left",
          "widgets": [
            { "id": "widget-catmenu", "type": "category-menu", "config": { "label": "Categorie" } }
          ]
        }
      ]
    }
  ]
}
```

---

## Section: Footer

Structured footer with columns, links, social icons, and newsletter. Uses draft/publish workflow.

### Data Structure

```typescript
interface IB2CStorefrontFooter {
  columns?: IFooterColumn[];
  social_links?: IFooterSocial[];
  copyright_text?: string;
  show_newsletter?: boolean;
  newsletter_heading?: string;
  newsletter_placeholder?: string;
  bg_color?: string;
  text_color?: string;
}

interface IFooterColumn {
  title: string;
  links: IFooterLink[];
}

interface IFooterLink {
  label: string;
  href: string;
  open_in_new_tab?: boolean;
}

interface IFooterSocial {
  platform: string;   // facebook, instagram, twitter, linkedin, youtube, tiktok, pinterest
  url: string;
}
```

### Save Draft

**Body:**

```json
{
  "footer_draft": {
    "bg_color": "#1f2937",
    "text_color": "#d1d5db",
    "copyright_text": "(c) 2026 Company Srl - P.IVA 12345678901",
    "show_newsletter": true,
    "newsletter_heading": "Stay updated",
    "newsletter_placeholder": "Enter your email",
    "columns": [
      {
        "title": "Products",
        "links": [
          { "label": "New Arrivals", "href": "/shop?sort=newest" },
          { "label": "Best Sellers", "href": "/shop?sort=popular" }
        ]
      },
      {
        "title": "Company",
        "links": [
          { "label": "About Us", "href": "/chi-siamo" },
          { "label": "Contact", "href": "/contatti" }
        ]
      }
    ],
    "social_links": [
      { "platform": "facebook", "url": "https://facebook.com/example" },
      { "platform": "instagram", "url": "https://instagram.com/example" }
    ]
  }
}
```

### Publish Footer

Send both fields with the same value to publish.

**Body:**

```json
{
  "footer": { ... },
  "footer_draft": { ... }
}
```

---

## Section: SEO & Meta Tags

Search engine optimization, Open Graph, Twitter Card, and structured data.

### Data Structure

```typescript
interface IB2CStorefrontMetaTags {
  // Basic SEO
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  robots?: string;
  canonical_url?: string;

  // Open Graph
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_site_name?: string;
  og_type?: string;

  // Twitter Card
  twitter_card?: string;
  twitter_site?: string;
  twitter_creator?: string;
  twitter_image?: string;

  // Additional
  theme_color?: string;
  google_site_verification?: string;
  bing_site_verification?: string;
  structured_data?: string;  // JSON-LD as string
}
```

### Save

**Body:**

```json
{
  "meta_tags": {
    "title": "Simani Industrie - Professional Equipment",
    "description": "Shop professional kitchen equipment and chef uniforms.",
    "keywords": "chef, kitchen, equipment, uniforms",
    "robots": "index, follow",
    "canonical_url": "https://shop.simani.it",
    "og_title": "Simani Industrie",
    "og_description": "Professional kitchen equipment",
    "og_image": "https://cdn.example.com/og-image.jpg",
    "og_site_name": "Simani Industrie",
    "og_type": "website",
    "twitter_card": "summary_large_image",
    "theme_color": "#009688",
    "structured_data": "{\"@context\":\"https://schema.org\",\"@type\":\"Organization\",\"name\":\"Simani Industrie\"}"
  }
}
```

| Field                        | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `title`                      | Browser tab & search results (50-60 chars)     |
| `description`                | Search result snippet (150-160 chars)          |
| `keywords`                   | Comma-separated keywords                       |
| `author`                     | Content author / company name                  |
| `robots`                     | `index, follow` / `noindex, nofollow` etc.     |
| `canonical_url`              | Preferred homepage URL                         |
| `og_title`                   | Social sharing title (falls back to `title`)   |
| `og_description`             | Social sharing description                     |
| `og_image`                   | Social sharing image (1200x630 recommended)    |
| `og_site_name`               | Site name for Open Graph                       |
| `og_type`                    | `website`, `article`, `product`, `business.business` |
| `twitter_card`               | `summary`, `summary_large_image`, `app`, `player` |
| `twitter_site`               | Site `@username`                               |
| `twitter_creator`            | Creator `@username`                            |
| `twitter_image`              | Twitter image (falls back to `og_image`)       |
| `theme_color`                | Mobile browser address bar color               |
| `google_site_verification`   | Google Search Console verification code        |
| `bing_site_verification`     | Bing Webmaster Tools verification code         |
| `structured_data`            | JSON-LD string for rich snippets               |

**Note:** `meta_tags` are merged on update — sending `{ "meta_tags": { "title": "New" } }` only updates the title, keeping all other fields intact.

---

## Public API (B2C Frontend)

The B2C frontend fetches the published storefront configuration via:

**Endpoint:** `GET /api/b2b/b2c/public/home`

**Headers:**

| Header          | Required | Description                      |
| --------------- | -------- | -------------------------------- |
| `x-api-key-id`  | yes      | API key ID                       |
| `x-api-secret`  | yes      | API key secret                   |
| `Origin`        | yes      | Storefront domain (for matching) |

**Response:**

```json
{
  "blocks": [ ... ],
  "seo": { ... },
  "storefront": {
    "name": "simani",
    "slug": "simani",
    "branding": {
      "title": "Simani Industrie",
      "logo_url": "https://...",
      "primary_color": "#009688",
      "secondary_color": "#00796b",
      "accent_color": "#ff5722",
      "font_family": "Inter"
    },
    "header": { ... },
    "header_config": {
      "rows": [ ... ]
    },
    "footer": {
      "columns": [ ... ],
      "social_links": [ ... ],
      "copyright_text": "...",
      "bg_color": "#1f2937",
      "text_color": "#d1d5db"
    },
    "meta_tags": {
      "title": "...",
      "description": "...",
      "og_image": "..."
    }
  }
}
```

The `storefront` object contains all published configuration. The B2C frontend uses this to render the header, footer, apply branding colors/fonts, and set HTML meta tags.

### Cache Invalidation

When settings are updated, a Redis event is published:

- **Channel:** `vinc-b2c:cache-invalidate:{slug}`
- **Message:** `site-config` (for branding/header/footer changes)

The B2C frontend should subscribe to this channel and refresh its cached config when events arrive.

---

## Frontend Usage Examples

### Fetch & Populate Settings

```typescript
const res = await fetch(`/api/b2b/b2c/storefronts/${slug}`);
const { data: storefront } = await res.json();

// General
const name = storefront.name;
const domains = storefront.domains;
const status = storefront.status;
const language = storefront.settings?.default_language;

// Branding
const branding = storefront.branding || {};

// Header (use draft for editing, published for live)
const headerDraft = storefront.header_config_draft || storefront.header_config || DEFAULT_HEADER;
const headerPublished = storefront.header_config || { rows: [] };

// Footer
const footerDraft = storefront.footer_draft ?? storefront.footer ?? {};
const footerPublished = storefront.footer || {};

// SEO
const metaTags = storefront.meta_tags || {};
```

### Save All Settings (General + Branding + SEO)

```typescript
await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name,
    channel,
    domains: formattedDomains,
    status,
    branding,
    header_config_draft: headerConfigDraft,
    footer_draft: footerDraft,
    meta_tags: metaTags,
    settings: { default_language: language },
  }),
});
```

### Publish Header

```typescript
await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    header_config: headerConfigDraft,
    header_config_draft: headerConfigDraft,
  }),
});
```

### Publish Footer

```typescript
await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    footer: footerDraft,
    footer_draft: footerDraft,
  }),
});
```

---

## Workflow Summary

| Section  | Save Action          | Publish Action                              |
| -------- | -------------------- | ------------------------------------------- |
| General  | PATCH with fields    | Saved immediately (no draft)                |
| Branding | PATCH with `branding`| Saved immediately (no draft)                |
| Header   | PATCH `header_config_draft` | PATCH both `header_config` + `header_config_draft` |
| Footer   | PATCH `footer_draft` | PATCH both `footer` + `footer_draft`        |
| SEO      | PATCH with `meta_tags` | Saved immediately (no draft)              |
