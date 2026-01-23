# Multi-Tenant Architecture

This document describes how multi-tenant configuration works in the VINC ecosystem, specifically how **vinc-b2b** (frontend) should resolve and use tenant configuration from **vinc-commerce-suite** (admin/registry).

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Request Flow                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Browser Request                                                    │
│   shop.example.com/products                                          │
│           │                                                          │
│           ▼                                                          │
│   ┌───────────────┐                                                  │
│   │   vinc-b2b    │  (Frontend Application)                          │
│   │   Next.js     │                                                  │
│   └───────┬───────┘                                                  │
│           │                                                          │
│           │ Query: { "domains.hostname": "shop.example.com" }        │
│           ▼                                                          │
│   ┌───────────────┐                                                  │
│   │  vinc-admin   │  (Tenant Registry Database)                      │
│   │   MongoDB     │                                                  │
│   │   tenants     │  Collection                                      │
│   └───────┬───────┘                                                  │
│           │                                                          │
│           │ Returns: tenant config (database, api credentials, etc)  │
│           ▼                                                          │
│   ┌───────────────┐                                                  │
│   │ vinc-tenant-x │  (Tenant-Specific Database)                      │
│   │   MongoDB     │  e.g., vinc-hidros-it                            │
│   └───────────────┘                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Tenant Schema (vinc-commerce-suite)

The tenant registry uses **snake_case** field names. Here's the complete schema:

```typescript
interface ITenant {
  // Core identification
  tenant_id: string;           // Unique identifier (e.g., "hidros-it")
  name: string;                // Display name (e.g., "Hidros S.r.l")
  status: "active" | "suspended" | "pending";
  admin_email: string;

  // Multi-tenant configuration
  project_code?: string;       // Project identifier (e.g., "vinc-hidros-it")

  domains?: Array<{
    hostname: string;          // e.g., "shop.example.com" (no protocol!)
    is_primary?: boolean;      // Primary domain for redirects
    is_active?: boolean;       // Enable/disable domain (default: true)
  }>;

  api?: {
    pim_api_url?: string;      // PIM API endpoint
    b2b_api_url?: string;      // B2B API endpoint
    api_key_id?: string;       // Format: ak_{tenant-id}_{12-hex-chars}
    api_secret?: string;       // Format: sk_{32-hex-chars}
  };

  database?: {
    mongo_url?: string;        // Custom MongoDB URL (optional)
    mongo_db?: string;         // Database name override
  };

  // Feature flags
  require_login?: boolean;     // Require authentication for access

  // Infrastructure (legacy)
  solr_core: string;
  solr_url?: string;
  mongo_db: string;            // Default: vinc-{tenant_id}

  // Timestamps
  created_at: Date;
  updated_at: Date;
  created_by: string;
}
```

### Important Notes

1. **Hostname Format**: Domains store hostname only, NOT full URLs
   - ✅ Correct: `shop.example.com`, `localhost:3000`
   - ❌ Wrong: `https://shop.example.com`, `http://localhost:3000`

2. **Field Naming**: All fields use **snake_case** (e.g., `is_primary`, `api_key_id`)

3. **Database Indexes**: An index exists on `domains.hostname` for efficient lookup

---

## Frontend Configuration (vinc-b2b)

### Environment Variables

```bash
# Enable multi-tenant mode
TENANT_MODE=multi

# Tenant registry database connection
TENANTS_MONGO_URL=mongodb://localhost:27017
TENANTS_DB=vinc-admin

# Optional: Default tenant for local development
DEFAULT_TENANT_ID=hidros-it
```

### Single-Tenant vs Multi-Tenant Mode

| Mode          | `TENANT_MODE` | Behavior                                    |
|---------------|---------------|---------------------------------------------|
| Single-tenant | `single`      | Uses fixed `VINC_TENANT_ID` from env        |
| Multi-tenant  | `multi`       | Resolves tenant by hostname from registry   |

---

## Tenant Resolution (vinc-b2b Implementation)

### Step 1: Extract Hostname from Request

```typescript
// src/lib/tenant/resolver.ts

export function extractHostname(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");

  // Use forwarded host if behind proxy, otherwise use URL host
  return forwardedHost || url.host;
}
```

### Step 2: Query Tenant Registry

```typescript
// src/lib/tenant/service.ts
import { MongoClient } from "mongodb";

interface TenantConfig {
  // Uses snake_case from database
  tenant_id: string;
  name: string;
  status: string;
  project_code?: string;
  domains?: Array<{
    hostname: string;
    is_primary?: boolean;
    is_active?: boolean;
  }>;
  api?: {
    pim_api_url?: string;
    b2b_api_url?: string;
    api_key_id?: string;
    api_secret?: string;
  };
  database?: {
    mongo_url?: string;
    mongo_db?: string;
  };
  require_login?: boolean;
  mongo_db: string;
}

let tenantsClient: MongoClient | null = null;

async function getTenantsCollection() {
  if (!tenantsClient) {
    tenantsClient = new MongoClient(process.env.TENANTS_MONGO_URL!);
    await tenantsClient.connect();
  }
  return tenantsClient
    .db(process.env.TENANTS_DB || "vinc-admin")
    .collection<TenantConfig>("tenants");
}

export async function findTenantByHostname(
  hostname: string
): Promise<TenantConfig | null> {
  const collection = await getTenantsCollection();

  // Query using snake_case field names
  const tenant = await collection.findOne({
    "domains.hostname": hostname.toLowerCase(),
    "domains.is_active": { $ne: false },  // Include undefined (default true)
    status: "active",
  });

  return tenant;
}
```

### Step 3: Transform to Frontend Format (Optional)

If your frontend prefers camelCase, create a transformer:

```typescript
// src/lib/tenant/transform.ts

interface FrontendTenantConfig {
  id: string;
  name: string;
  projectCode?: string;
  domains?: Array<{
    hostname: string;
    isPrimary?: boolean;
    isActive?: boolean;
  }>;
  api?: {
    pimApiUrl?: string;
    b2bApiUrl?: string;
    apiKeyId?: string;
    apiSecret?: string;
  };
  database?: {
    mongoUrl?: string;
    mongoDb?: string;
  };
  requireLogin?: boolean;
  isActive: boolean;
}

export function transformTenant(tenant: TenantConfig): FrontendTenantConfig {
  return {
    id: tenant.tenant_id,
    name: tenant.name,
    projectCode: tenant.project_code,
    domains: tenant.domains?.map(d => ({
      hostname: d.hostname,
      isPrimary: d.is_primary,
      isActive: d.is_active,
    })),
    api: tenant.api ? {
      pimApiUrl: tenant.api.pim_api_url,
      b2bApiUrl: tenant.api.b2b_api_url,
      apiKeyId: tenant.api.api_key_id,
      apiSecret: tenant.api.api_secret,
    } : undefined,
    database: tenant.database ? {
      mongoUrl: tenant.database.mongo_url,
      mongoDb: tenant.database.mongo_db,
    } : undefined,
    requireLogin: tenant.require_login,
    isActive: tenant.status === "active",
  };
}
```

### Step 4: Middleware Integration

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findTenantByHostname } from "@/lib/tenant/service";

export async function middleware(request: NextRequest) {
  // Skip for static assets and API routes
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Skip if single-tenant mode
  if (process.env.TENANT_MODE !== "multi") {
    return NextResponse.next();
  }

  const hostname = extractHostname(request);
  const tenant = await findTenantByHostname(hostname);

  if (!tenant) {
    // Tenant not found - show error or redirect
    return NextResponse.rewrite(new URL("/tenant-not-found", request.url));
  }

  // Add tenant info to headers for downstream use
  const response = NextResponse.next();
  response.headers.set("x-tenant-id", tenant.tenant_id);
  response.headers.set("x-tenant-db", tenant.database?.mongo_db || tenant.mongo_db);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Database Connection

Once tenant is resolved, connect to their specific database:

```typescript
// src/lib/db/tenant-connection.ts
import { MongoClient } from "mongodb";

const connections = new Map<string, MongoClient>();

export async function getTenantDb(tenantConfig: TenantConfig) {
  const dbName = tenantConfig.database?.mongo_db || tenantConfig.mongo_db;
  const mongoUrl = tenantConfig.database?.mongo_url || process.env.VINC_MONGO_URL;

  const cacheKey = `${mongoUrl}:${dbName}`;

  if (!connections.has(cacheKey)) {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    connections.set(cacheKey, client);
  }

  return connections.get(cacheKey)!.db(dbName);
}
```

---

## API Authentication

When making API calls on behalf of a tenant, use their credentials:

```typescript
// src/lib/api/tenant-api.ts

export async function callTenantApi(
  tenantConfig: TenantConfig,
  endpoint: string,
  options: RequestInit = {}
) {
  const baseUrl = tenantConfig.api?.pim_api_url || process.env.DEFAULT_API_URL;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add API key authentication if configured
  if (tenantConfig.api?.api_key_id && tenantConfig.api?.api_secret) {
    headers["x-auth-method"] = "api-key";
    headers["x-api-key-id"] = tenantConfig.api.api_key_id;
    headers["x-api-secret"] = tenantConfig.api.api_secret;
  }

  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });
}
```

---

## Example: Complete Request Flow

```typescript
// src/app/products/page.tsx
import { headers } from "next/headers";
import { findTenantByHostname, transformTenant } from "@/lib/tenant";
import { getTenantDb } from "@/lib/db/tenant-connection";

export default async function ProductsPage() {
  // Get hostname from middleware-set header or request
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");

  if (!tenantId) {
    return <div>Tenant not found</div>;
  }

  // Get full tenant config (cached in production)
  const tenant = await findTenantById(tenantId);
  const config = transformTenant(tenant);

  // Connect to tenant database
  const db = await getTenantDb(tenant);
  const products = await db.collection("pimproducts")
    .find({ status: "published" })
    .limit(20)
    .toArray();

  return (
    <div>
      <h1>{config.name} - Products</h1>
      {products.map(p => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  );
}
```

---

## Caching Recommendations

For production, implement caching to avoid repeated database queries:

```typescript
// src/lib/tenant/cache.ts
import { LRUCache } from "lru-cache";

const tenantCache = new LRUCache<string, TenantConfig>({
  max: 100,           // Max 100 tenants cached
  ttl: 1000 * 60 * 5, // 5 minute TTL
});

export async function getCachedTenant(hostname: string): Promise<TenantConfig | null> {
  const cached = tenantCache.get(hostname);
  if (cached) return cached;

  const tenant = await findTenantByHostname(hostname);
  if (tenant) {
    tenantCache.set(hostname, tenant);
  }
  return tenant;
}

// Invalidate cache when tenant is updated (call from admin)
export function invalidateTenantCache(hostname: string) {
  tenantCache.delete(hostname);
}
```

---

## Field Reference

### Snake_case to camelCase Mapping

| Database (snake_case) | Frontend (camelCase) |
|-----------------------|----------------------|
| `tenant_id`           | `id`                 |
| `project_code`        | `projectCode`        |
| `is_primary`          | `isPrimary`          |
| `is_active`           | `isActive`           |
| `pim_api_url`         | `pimApiUrl`          |
| `b2b_api_url`         | `b2bApiUrl`          |
| `api_key_id`          | `apiKeyId`           |
| `api_secret`          | `apiSecret`          |
| `mongo_url`           | `mongoUrl`           |
| `mongo_db`            | `mongoDb`            |
| `require_login`       | `requireLogin`       |

### API Key Formats

| Field         | Format                              | Example                              |
|---------------|-------------------------------------|--------------------------------------|
| `api_key_id`  | `ak_{tenant-id}_{12-hex-chars}`     | `ak_hidros-it_aabbccddeeff`          |
| `api_secret`  | `sk_{32-hex-chars}`                 | `sk_aabbccddeeff00112233445566778899`|

---

## Retrieving Home Page Data

The frontend needs to fetch two types of data for the home page:

1. **Home Settings** - Branding, theme colors, header, footer (tenant-wide configuration)
2. **Home Template** - Page blocks/content (versioned with draft/publish workflow)

### Home Settings (Branding, Theme, Header, Footer)

Fetch tenant-wide storefront configuration:

```typescript
// src/lib/api/home-settings.ts

interface HomeSettings {
  branding: {
    title: string;
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    textColor?: string;
    mutedColor?: string;
    backgroundColor?: string;
    headerBackgroundColor?: string;
    footerBackgroundColor?: string;
    footerTextColor?: string;
  };
  defaultCardVariant?: "b2b" | "horizontal" | "compact" | "detailed";
  cardStyle?: ProductCardStyle;
  footerHtml?: string;           // Published footer HTML
  headerConfig?: HeaderConfig;    // Published header configuration
  meta_tags?: MetaTags;           // SEO configuration
}

export async function getHomeSettings(tenantConfig: TenantConfig): Promise<HomeSettings> {
  const baseUrl = tenantConfig.api?.b2b_api_url || process.env.DEFAULT_API_URL;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add API key authentication if configured
  if (tenantConfig.api?.api_key_id && tenantConfig.api?.api_secret) {
    headers["x-auth-method"] = "api-key";
    headers["x-api-key-id"] = tenantConfig.api.api_key_id;
    headers["x-api-secret"] = tenantConfig.api.api_secret;
  }

  const response = await fetch(`${baseUrl}/api/b2b/home-settings`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch home settings: ${response.status}`);
  }

  return response.json();
}
```

### Home Template (Page Blocks)

Fetch the published home page template with blocks:

```typescript
// src/lib/api/home-template.ts

interface HomeTemplateBlock {
  id: string;
  type: string;          // "hero", "featured-products", "banner", etc.
  order: number;
  config: Record<string, any>;
  metadata?: Record<string, any>;
}

interface PublishedHomeTemplate {
  blocks: HomeTemplateBlock[];
  seo?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
  version: number;
  publishedAt?: string;
  tags?: {
    campaign?: string;
    segment?: string;
    attributes?: Record<string, string | string[]>;
  };
}

export async function getPublishedHomeTemplate(
  tenantConfig: TenantConfig
): Promise<PublishedHomeTemplate | null> {
  const db = await getTenantDb(tenantConfig);

  // Find the current published version
  const template = await db.collection("hometemplates").findOne({
    templateId: "home-page",
    isCurrentPublished: true,
    status: "published"
  });

  if (!template) {
    return null;
  }

  return {
    blocks: template.blocks || [],
    seo: template.seo,
    version: template.version,
    publishedAt: template.publishedAt,
    tags: template.tags
  };
}
```

### Combined Home Page Fetch

Fetch both settings and template in parallel:

```typescript
// src/lib/api/home-page.ts

export interface HomePageData {
  settings: HomeSettings;
  template: PublishedHomeTemplate | null;
}

export async function getHomePageData(tenantConfig: TenantConfig): Promise<HomePageData> {
  const [settings, template] = await Promise.all([
    getHomeSettings(tenantConfig),
    getPublishedHomeTemplate(tenantConfig)
  ]);

  return { settings, template };
}
```

### Rendering the Home Page

```tsx
// src/app/page.tsx
import { getHomePageData } from "@/lib/api/home-page";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";

export default async function HomePage() {
  const tenantConfig = await getCurrentTenant();
  const { settings, template } = await getHomePageData(tenantConfig);

  // Apply theme colors via CSS variables
  const themeStyles = {
    "--color-primary": settings.branding.primaryColor || "#009f7f",
    "--color-secondary": settings.branding.secondaryColor || "#02b290",
    "--color-accent": settings.branding.accentColor || settings.branding.primaryColor,
    "--color-text": settings.branding.textColor || "#000000",
    "--color-muted": settings.branding.mutedColor || "#595959",
    "--color-background": settings.branding.backgroundColor || "#ffffff",
  } as React.CSSProperties;

  return (
    <div style={themeStyles}>
      {/* Header */}
      {settings.headerConfig && (
        <Header config={settings.headerConfig} branding={settings.branding} />
      )}

      {/* Page blocks */}
      <main>
        {template?.blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            type={block.type}
            config={block.config}
            cardStyle={settings.cardStyle}
          />
        ))}
      </main>

      {/* Footer */}
      {settings.footerHtml && (
        <Footer
          html={settings.footerHtml}
          backgroundColor={settings.branding.footerBackgroundColor}
          textColor={settings.branding.footerTextColor}
        />
      )}
    </div>
  );
}
```

### Preview Mode (Draft Content)

For admin preview, fetch the latest draft instead of published:

```typescript
export async function getPreviewHomeTemplate(
  tenantConfig: TenantConfig
): Promise<PublishedHomeTemplate | null> {
  const db = await getTenantDb(tenantConfig);

  // Find the current working version (draft or published)
  const template = await db.collection("hometemplates").findOne({
    templateId: "home-page",
    isCurrent: true
  });

  if (!template) {
    return null;
  }

  return {
    blocks: template.blocks || [],
    seo: template.seo,
    version: template.version,
    publishedAt: template.publishedAt,
    tags: template.tags
  };
}
```

### API Endpoints Reference

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/b2b/home-settings` | GET | Get tenant home settings (branding, header, footer) |
| `/api/home-template` | GET | Get home template config (builder use) |
| `/api/home-template?v=2` | GET | Load specific version |

### Block Types

Common block types in home templates:

| Type | Description |
| ---- | ----------- |
| `hero` | Hero banner with image/text |
| `featured-products` | Product carousel/grid |
| `banner` | Promotional banner |
| `category-grid` | Category navigation |
| `text-content` | Rich text block |
| `image-gallery` | Image carousel |
| `cta` | Call-to-action section |

---

## Troubleshooting

### Tenant Not Found

1. Check hostname format (no protocol)
2. Verify `domains.is_active` is not `false`
3. Verify tenant `status` is `"active"`
4. Check database index: `db.tenants.createIndex({ "domains.hostname": 1 })`

### Database Connection Fails

1. Check `database.mongo_url` or fallback `VINC_MONGO_URL`
2. Verify `database.mongo_db` or fallback `mongo_db` field

### API Authentication Fails

1. Verify `api.api_key_id` format: `ak_{tenant-id}_{hex}`
2. Verify `api.api_secret` format: `sk_{hex}`
3. Check API endpoint is accessible

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project guidelines and multi-tenant database patterns
- [B2B E-commerce Integration](../02-api/b2b-ecommerce-integration.md) - API authentication
