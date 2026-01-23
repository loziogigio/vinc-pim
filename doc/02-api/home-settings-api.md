# Home Settings API

API for managing tenant-wide storefront configuration including branding, theme colors, product card styling, CDN credentials, SMTP settings, and custom footer HTML.

## Base URL

```
/api/b2b/home-settings
```

## Authentication

All endpoints require B2B authentication via session or API key headers.

| Method | Headers |
|--------|---------|
| Session | Cookie-based |
| API Key | `x-auth-method`, `x-api-key-id`, `x-api-secret` |

---

## Get Home Settings

Retrieves the global home settings configuration for the current tenant.

**Endpoint:** `GET /api/b2b/home-settings`

### Response

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "customerId": "global-b2b-home",
  "branding": {
    "title": "My B2B Store",
    "logo": "https://cdn.example.com/logo.png",
    "favicon": "https://cdn.example.com/favicon.ico",
    "primaryColor": "#009f7f",
    "secondaryColor": "#02b290",
    "shopUrl": "https://shop.example.com",
    "websiteUrl": "https://www.example.com",
    "accentColor": "#3b82f6",
    "textColor": "#000000",
    "mutedColor": "#595959",
    "backgroundColor": "#ffffff",
    "headerBackgroundColor": "",
    "footerBackgroundColor": "#f5f5f5",
    "footerTextColor": "#666666"
  },
  "defaultCardVariant": "b2b",
  "cardStyle": {
    "borderWidth": 1,
    "borderColor": "#EAEEF2",
    "borderStyle": "solid",
    "shadowSize": "none",
    "shadowColor": "rgba(0, 0, 0, 0.1)",
    "borderRadius": "md",
    "hoverEffect": "none",
    "backgroundColor": "#ffffff"
  },
  "footerHtml": "<div class=\"flex flex-col gap-4\">...</div>",
  "footerHtmlDraft": "<div class=\"flex flex-col gap-4\">...</div>",
  "headerConfig": {
    "rows": [
      {
        "id": "main",
        "enabled": true,
        "fixed": true,
        "backgroundColor": "#ffffff",
        "layout": "20-60-20",
        "blocks": [
          { "id": "left", "alignment": "left", "widgets": [{ "id": "logo", "type": "logo", "config": {} }] },
          { "id": "center", "alignment": "center", "widgets": [{ "id": "search", "type": "search-bar", "config": {} }] },
          { "id": "right", "alignment": "right", "widgets": [{ "id": "cart", "type": "cart", "config": {} }] }
        ]
      }
    ]
  },
  "headerConfigDraft": {
    "rows": [
      {
        "id": "main",
        "enabled": true,
        "fixed": true,
        "backgroundColor": "#ffffff",
        "layout": "20-60-20",
        "blocks": [
          { "id": "left", "alignment": "left", "widgets": [{ "id": "logo", "type": "logo", "config": {} }] },
          { "id": "center", "alignment": "center", "widgets": [{ "id": "search", "type": "search-bar", "config": {} }] },
          { "id": "right", "alignment": "right", "widgets": [{ "id": "cart", "type": "cart", "config": {} }] }
        ]
      }
    ]
  },
  "meta_tags": {
    "title": "My B2B Store - Wholesale Products",
    "description": "Your trusted B2B wholesale partner",
    "ogImage": "https://cdn.example.com/og-image.jpg",
    "twitterCard": "summary_large_image",
    "themeColor": "#009f7f"
  },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:45:00.000Z",
  "lastModifiedBy": "admin@example.com"
}
```

### Example

```bash
curl "http://localhost:3001/api/b2b/home-settings" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}"
```

---

## Update Home Settings

Create or update the global home settings document.

**Endpoint:** `POST /api/b2b/home-settings`

### Request Body

```typescript
{
  branding?: CompanyBranding;
  defaultCardVariant?: "b2b" | "horizontal" | "compact" | "detailed";
  cardStyle?: ProductCardStyle;
  cdn_credentials?: CDNCredentials;
  smtp_settings?: SMTPSettings;
  footerHtml?: string;           // Published footer HTML
  footerHtmlDraft?: string;      // Draft footer HTML (for preview)
  headerConfig?: HeaderConfig;   // Published header configuration
  headerConfigDraft?: HeaderConfig; // Draft header configuration (for preview)
  meta_tags?: MetaTags;          // SEO meta tags configuration
  lastModifiedBy?: string;
}
```

### Example

```bash
curl -X POST "http://localhost:3001/api/b2b/home-settings" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "branding": {
      "title": "My Store",
      "primaryColor": "#009f7f",
      "secondaryColor": "#02b290",
      "accentColor": "#3b82f6",
      "textColor": "#000000",
      "backgroundColor": "#ffffff",
      "footerBackgroundColor": "#f5f5f5",
      "footerTextColor": "#666666"
    },
    "defaultCardVariant": "b2b",
    "lastModifiedBy": "admin@example.com"
  }'
```

---

## Initialize Home Settings

Initialize default settings for a new tenant. Creates the settings document if it doesn't exist.

**Endpoint:** `PUT /api/b2b/home-settings`

### Request Body

```json
{
  "companyTitle": "My B2B Store"
}
```

### Example

```bash
curl -X PUT "http://localhost:3001/api/b2b/home-settings" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "companyTitle": "My B2B Store"
  }'
```

---

## Data Types

### CompanyBranding

Branding and theme configuration for the storefront.

```typescript
interface CompanyBranding {
  // Required
  title: string;                    // Company/store name

  // Basic branding (optional)
  logo?: string;                    // Logo URL
  favicon?: string;                 // Favicon URL
  primaryColor?: string;            // Primary brand color (hex, e.g., "#009f7f")
  secondaryColor?: string;          // Secondary brand color (hex)
  shopUrl?: string;                 // Shop URL for email redirects
  websiteUrl?: string;              // Company website URL

  // Extended theme colors (optional)
  accentColor?: string;             // Accent color for buttons, links, CTAs
  textColor?: string;               // Main body text color (default: "#000000")
  mutedColor?: string;              // Secondary/muted text color (default: "#595959")
  backgroundColor?: string;         // Page background color (default: "#ffffff")
  headerBackgroundColor?: string;   // Header background (empty = transparent/inherit)
  footerBackgroundColor?: string;   // Footer background color (default: "#f5f5f5")
  footerTextColor?: string;         // Footer text color (default: "#666666")
}
```

#### Extended Theme Colors

The extended theme colors enable multi-tenant theming with granular control over storefront appearance:

| Field | Default | Description |
|-------|---------|-------------|
| `accentColor` | `""` (falls back to primaryColor) | Accent color for buttons, links, and CTAs |
| `textColor` | `#000000` | Main body text color |
| `mutedColor` | `#595959` | Secondary/muted text color for descriptions |
| `backgroundColor` | `#ffffff` | Page background color |
| `headerBackgroundColor` | `""` (transparent/inherit) | Header background color |
| `footerBackgroundColor` | `#f5f5f5` | Footer background color |
| `footerTextColor` | `#666666` | Footer text color |

### ProductCardStyle

Styling configuration for product cards throughout the storefront.

```typescript
interface ProductCardStyle {
  borderWidth: number;              // Border width in pixels (0-10)
  borderColor: string;              // Border color (hex)
  borderStyle: "solid" | "dashed" | "dotted" | "none";
  shadowSize: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
  shadowColor: string;              // Shadow color (rgba)
  borderRadius: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  hoverEffect: "none" | "lift" | "shadow" | "scale" | "border" | "glow";
  hoverScale?: number;              // Scale factor for scale effect (e.g., 1.02)
  hoverShadowSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  backgroundColor: string;          // Card background color
  hoverBackgroundColor?: string;    // Background color on hover
}
```

### CDNCredentials

Credentials for cloud storage (IBM Cloud Object Storage, AWS S3, etc.).

```typescript
interface CDNCredentials {
  cdn_url?: string;           // CDN endpoint URL
  bucket_region?: string;     // Bucket region (e.g., "eu-de")
  bucket_name?: string;       // Bucket name
  folder_name?: string;       // Folder path within bucket
  cdn_key?: string;           // Access key ID
  cdn_secret?: string;        // Secret access key
  signed_url_expiry?: number; // Signed URL expiry in seconds (0 = public)
  delete_from_cloud?: boolean; // Delete files when removed from database
}
```

### SMTPSettings

SMTP configuration for sending emails.

```typescript
interface SMTPSettings {
  host?: string;        // SMTP host (e.g., "smtp.hostinger.com")
  port?: number;        // SMTP port (e.g., 587)
  secure?: boolean;     // Use TLS (true for port 465)
  user?: string;        // SMTP username
  password?: string;    // SMTP password
  from?: string;        // From email address
  from_name?: string;   // From display name
  default_to?: string;  // Default recipient for notifications
}
```

### HeaderConfig

Configuration for the storefront header builder with rows, blocks, and widgets.

```typescript
interface HeaderConfig {
  rows: HeaderRow[];
}

interface HeaderRow {
  id: string;
  enabled: boolean;
  fixed: boolean;           // Sticky/freeze row
  backgroundColor?: string;
  textColor?: string;
  height?: number;          // Row height in px
  layout: RowLayout;        // Layout preset
  blocks: HeaderBlock[];
}

type RowLayout =
  | "full"           // 1 block: 100%
  | "50-50"          // 2 blocks: 50% / 50%
  | "33-33-33"       // 3 blocks: 33% / 33% / 33%
  | "20-60-20"       // 3 blocks: 20% / 60% / 20% (main header style)
  | "25-50-25"       // 3 blocks: 25% / 50% / 25%
  | "30-40-30";      // 3 blocks: 30% / 40% / 30%

interface HeaderBlock {
  id: string;
  alignment: "left" | "center" | "right";
  widgets: HeaderWidget[];
}

interface HeaderWidget {
  id: string;
  type: HeaderWidgetType;
  config: WidgetConfig;
}

type HeaderWidgetType =
  | "logo"           // Company logo
  | "search-bar"     // Product search
  | "radio-widget"   // Radio player with links
  | "category-menu"  // Categories dropdown
  | "cart"           // Shopping cart
  | "company-info"   // Delivery address, balance
  | "no-price"       // Toggle price visibility
  | "favorites"      // Wishlist
  | "compare"        // Product comparison
  | "profile"        // User profile/login
  | "button"         // Custom button/link (multiple allowed)
  | "spacer"         // Flexible space (multiple allowed)
  | "divider";       // Vertical divider (multiple allowed)
```

#### Layout Presets

| Layout | Blocks | Description |
|--------|--------|-------------|
| `full` | 1 | Single full-width block |
| `50-50` | 2 | Two equal columns |
| `33-33-33` | 3 | Three equal columns |
| `20-60-20` | 3 | Main header style (Logo \| Search \| Icons) |
| `25-50-25` | 3 | Balanced header |
| `30-40-30` | 3 | Compact center |

#### Widget Configuration Examples

```typescript
// Button widget
{ type: "button", config: { label: "Promozioni", url: "/promotions", variant: "primary" } }

// Search bar widget
{ type: "search-bar", config: { placeholder: "Search products...", width: "lg" } }

// Category menu widget
{ type: "category-menu", config: { label: "Categories", menuId: "main-menu" } }

// Icon widgets (cart, favorites, compare, profile)
{ type: "cart", config: { showLabel: true, showBadge: true } }

// Radio widget with header icon and multiple stations
{
  type: "radio-widget",
  config: {
    enabled: true,
    headerIcon: "https://cdn.example.com/radio-icon.png",
    stations: [
      { id: "station-rtl", name: "RTL 102.5", logoUrl: "", streamUrl: "https://streamingv2.shoutcast.com/rtl-102-5" },
      { id: "station-rds", name: "RDS", logoUrl: "", streamUrl: "https://icstream.rds.radio/rds" }
    ]
  }
}
```

**Note:** New header configurations come with RTL 102.5 and RDS pre-configured as default radio stations.

---

### Header Builder (Draft/Publish)

Header configuration with draft/publish workflow for safe editing with live preview.

| Field | Type | Description |
|-------|------|-------------|
| `headerConfig` | `HeaderConfig` | Published header configuration (displayed on storefront) |
| `headerConfigDraft` | `HeaderConfig` | Draft header configuration (for preview before publishing) |

**Workflow:**
1. Edit the draft (`headerConfigDraft`) in the admin UI with live preview
2. Add/remove rows, adjust layouts, and configure widgets
3. Save changes to persist the draft
4. Click "Publish" to copy draft to published (`headerConfig`)
5. Use "Revert to Published" to discard draft changes

**Toggle Builder:**
The admin UI provides a "Hide/Show Builder" toggle to collapse the builder interface while keeping the preview visible. This allows reviewing the header preview without the builder clutter.

#### Publishing Header Configuration

```typescript
// Publish header (copy draft to published)
const publishResponse = await fetch('/api/b2b/home-settings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-method': 'api-key',
    'x-api-key-id': 'ak_{tenant-id}_{key-suffix}',
    'x-api-secret': 'sk_{secret}'
  },
  body: JSON.stringify({
    headerConfig: draftConfig,       // Copy draft to published
    headerConfigDraft: draftConfig,  // Keep draft in sync
    lastModifiedBy: "admin@company.com"
  })
});
```

---

### Footer HTML (Draft/Publish)

Custom HTML content for the storefront footer with draft/publish workflow.

| Field | Type | Description |
|-------|------|-------------|
| `footerHtml` | `string` | Published footer HTML (displayed on storefront) |
| `footerHtmlDraft` | `string` | Draft footer HTML (for preview before publishing) |

**Workflow:**
1. Edit the draft (`footerHtmlDraft`) in the admin UI with live preview
2. Upload images using the image upload panel (stored in CDN)
3. Insert image URLs into the HTML
4. Save changes to persist the draft
5. Click "Publish" to copy draft to published (`footerHtml`)

#### Uploading Footer Images

Use the general upload endpoint to upload images for use in footer HTML:

**Endpoint:** `POST /api/uploads`

```bash
curl -X POST "http://localhost:3001/api/uploads" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -F "file=@/path/to/image.png"
```

**Response:**
```json
{
  "url": "https://cdn.example.com/uploads/1706123456789-image.png",
  "key": "uploads/1706123456789-image.png",
  "size": 45678,
  "contentType": "image/png"
}
```

**Supported formats:** JPEG, PNG, WebP, GIF (max 20MB)

**Example HTML with Tailwind classes:**

```html
<div class="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
  <div class="flex items-center gap-4">
    <img src="/assets/logo.png" class="h-[80px] w-auto" alt="Logo" />
    <div class="text-[40px] text-[#7a7a7a]">
      <div class="font-bold">Company</div>
      <div class="font-normal">Name</div>
    </div>
  </div>

  <div class="flex flex-col gap-3 text-sm">
    <div>📍 Via Example 123, Milan</div>
    <div>📞 +39 0123 456789</div>
    <div>✉️ info@company.com</div>
  </div>
</div>
```

**Security:** HTML is sanitized with DOMPurify before rendering to prevent XSS attacks.

---

### MetaTags (SEO Configuration)

SEO meta tags for search engine optimization and social media sharing.

```typescript
interface MetaTags {
  // Basic SEO
  title?: string;              // Page title (50-60 chars recommended)
  description?: string;        // Meta description (150-160 chars recommended)
  keywords?: string;           // Comma-separated keywords
  author?: string;             // Content author
  robots?: string;             // e.g., "index, follow" or "noindex, nofollow"
  canonicalUrl?: string;       // Preferred URL for homepage

  // Open Graph (Facebook, LinkedIn)
  ogTitle?: string;            // Defaults to title if not set
  ogDescription?: string;      // Defaults to description if not set
  ogImage?: string;            // Image URL (1200x630 recommended)
  ogSiteName?: string;         // Website name
  ogType?: string;             // "website", "article", "product", etc.

  // Twitter Card
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterSite?: string;        // @username of the site
  twitterCreator?: string;     // @username of content creator
  twitterImage?: string;       // Image URL (defaults to ogImage)

  // Additional
  structuredData?: string;     // JSON-LD as stringified JSON
  themeColor?: string;         // Mobile browser theme color
  googleSiteVerification?: string;
  bingSiteVerification?: string;
}
```

#### Example Request

```bash
curl -X POST "http://localhost:3001/api/b2b/home-settings" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "meta_tags": {
      "title": "My B2B Store - Wholesale Products",
      "description": "Your trusted B2B wholesale partner for quality products",
      "ogImage": "https://cdn.example.com/og-image.jpg",
      "ogSiteName": "My B2B Store",
      "twitterCard": "summary_large_image",
      "twitterSite": "@mystore",
      "themeColor": "#009f7f",
      "googleSiteVerification": "abc123"
    },
    "lastModifiedBy": "admin@example.com"
  }'
```

#### Rendering Meta Tags

In your storefront's document head:

```tsx
// In Next.js layout or page
export const metadata = {
  title: settings.meta_tags?.title || settings.branding?.title,
  description: settings.meta_tags?.description,
  keywords: settings.meta_tags?.keywords,
  openGraph: {
    title: settings.meta_tags?.ogTitle || settings.meta_tags?.title,
    description: settings.meta_tags?.ogDescription || settings.meta_tags?.description,
    images: settings.meta_tags?.ogImage ? [settings.meta_tags.ogImage] : [],
    siteName: settings.meta_tags?.ogSiteName,
    type: settings.meta_tags?.ogType || 'website',
  },
  twitter: {
    card: settings.meta_tags?.twitterCard || 'summary_large_image',
    site: settings.meta_tags?.twitterSite,
    creator: settings.meta_tags?.twitterCreator,
    images: settings.meta_tags?.twitterImage || settings.meta_tags?.ogImage,
  },
  themeColor: settings.meta_tags?.themeColor,
  verification: {
    google: settings.meta_tags?.googleSiteVerification,
    bing: settings.meta_tags?.bingSiteVerification,
  },
};
```

---

## Testing Endpoints

### Test CDN Connection

Verify CDN credentials are working correctly.

**Endpoint:** `POST /api/b2b/home-settings/test-cdn`

```bash
curl -X POST "http://localhost:3001/api/b2b/home-settings/test-cdn" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}"
```

### Test SMTP Connection

Verify SMTP settings by sending a test email.

**Endpoint:** `POST /api/b2b/home-settings/test-smtp`

```bash
curl -X POST "http://localhost:3001/api/b2b/home-settings/test-smtp" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "to": "test@example.com"
  }'
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad request (missing required fields) |
| `404` | Settings not found |
| `500` | Internal server error |

---

## Usage Examples

### Setting Up Multi-Tenant Theming

```typescript
// Example: Configure a tenant with custom branding
const response = await fetch('/api/b2b/home-settings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-method': 'api-key',
    'x-api-key-id': 'ak_{tenant-id}_{key-suffix}',
    'x-api-secret': 'sk_{secret}'
  },
  body: JSON.stringify({
    branding: {
      title: "Acme Corporation",
      logo: "https://cdn.example.com/acme-logo.png",
      primaryColor: "#1a56db",
      secondaryColor: "#3f83f8",
      accentColor: "#f59e0b",
      textColor: "#111827",
      mutedColor: "#6b7280",
      backgroundColor: "#ffffff",
      headerBackgroundColor: "#1a56db",
      footerBackgroundColor: "#111827",
      footerTextColor: "#ffffff"
    },
    lastModifiedBy: "admin@acme.com"
  })
});
```

### Reading Theme Colors in Storefront

```typescript
// Fetch settings and apply to CSS variables
const settings = await fetch('/api/b2b/home-settings').then(r => r.json());
const { branding } = settings;

document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
document.documentElement.style.setProperty('--color-secondary', branding.secondaryColor);
document.documentElement.style.setProperty('--color-accent', branding.accentColor || branding.primaryColor);
document.documentElement.style.setProperty('--color-text', branding.textColor);
document.documentElement.style.setProperty('--color-muted', branding.mutedColor);
document.documentElement.style.setProperty('--color-background', branding.backgroundColor);
document.documentElement.style.setProperty('--color-footer-bg', branding.footerBackgroundColor);
document.documentElement.style.setProperty('--color-footer-text', branding.footerTextColor);
```

### Tailwind CSS Integration

```typescript
// tailwind.config.js - using CSS variables
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        'text-main': 'var(--color-text)',
        muted: 'var(--color-muted)',
        background: 'var(--color-background)',
        'footer-bg': 'var(--color-footer-bg)',
        'footer-text': 'var(--color-footer-text)',
      }
    }
  }
};
```

### Footer HTML Management

```typescript
// Update footer HTML draft (for preview)
const response = await fetch('/api/b2b/home-settings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-method': 'api-key',
    'x-api-key-id': 'ak_{tenant-id}_{key-suffix}',
    'x-api-secret': 'sk_{secret}'
  },
  body: JSON.stringify({
    footerHtmlDraft: `<div class="flex flex-col gap-4">
      <div class="text-lg font-bold">Company Name</div>
      <div class="text-sm text-gray-600">Contact: info@company.com</div>
    </div>`,
    lastModifiedBy: "admin@company.com"
  })
});

// Publish footer (copy draft to published)
const publishResponse = await fetch('/api/b2b/home-settings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-method': 'api-key',
    'x-api-key-id': 'ak_{tenant-id}_{key-suffix}',
    'x-api-secret': 'sk_{secret}'
  },
  body: JSON.stringify({
    footerHtml: draftContent, // Copy draft to published
    lastModifiedBy: "admin@company.com"
  })
});
```

### Rendering Footer HTML Safely

```typescript
import DOMPurify from 'dompurify';

// Fetch settings
const settings = await fetch('/api/b2b/home-settings').then(r => r.json());

// Sanitize and render footer HTML
const sanitizedHtml = DOMPurify.sanitize(settings.footerHtml || '', {
  ADD_TAGS: ['style'],
  ADD_ATTR: ['class', 'style', 'src', 'alt', 'href', 'target']
});

// Use in React component
<footer
  className="bg-footer-bg text-footer-text"
  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
/>
```
