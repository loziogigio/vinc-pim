# Project Standards & Conventions

This document defines the coding standards, naming conventions, and architectural patterns used throughout the VINC Storefront project.

---

## Table of Contents

1. [MongoDB & Database Standards](#mongodb--database-standards)
2. [File & Directory Structure](#file--directory-structure)
3. [TypeScript & Code Style](#typescript--code-style)
   - [Shared Types Location](#shared-types-location)
4. [API Route Conventions](#api-route-conventions)
5. [Public API Endpoints](#public-api-endpoints)
6. [Component Standards](#component-standards)
7. [Environment Variables](#environment-variables)
8. [Solr Configuration](#solr-configuration)

---

## MongoDB & Database Standards

### Collection Naming Convention

**Standard**: Use **lowercase, no underscores, pluralized** collection names.

This follows MongoDB/Mongoose default conventions:
- Model names use PascalCase
- Mongoose automatically pluralizes and lowercases model names
- Do NOT use underscores in collection names
- Do NOT use explicit `collection:` option unless required for legacy compatibility

**When to use explicit collection names:**
- When the collection name doesn't match Mongoose's automatic pluralization
- Example: `B2BHomeSettings` → Mongoose would create `b2bhomesettings` automatically, but we explicitly set it for clarity
- Always use explicit collection name if the model name could be ambiguous

#### Examples

✅ **Correct**:
```typescript
// Model: ImportSource → Collection: importsources
mongoose.model<IImportSource>("ImportSource", ImportSourceSchema);

// Model: PIMProduct → Collection: pimproducts
mongoose.model<IPIMProduct>("PIMProduct", PIMProductSchema);

// Model: ImportJob → Collection: importjobs
mongoose.model<IImportJob>("ImportJob", ImportJobSchema);
```

❌ **Incorrect**:
```typescript
// Don't use underscores
collection: "import_sources"  // ❌
collection: "pim_products"    // ❌
collection: "import_jobs"     // ❌
```

### Collection Name Reference

| Model Name | Collection Name | File Location | Notes |
|-----------|----------------|---------------|-------|
| `ActivityLogModel` | `activitylogs` | `models/activity-log.ts` | |
| `B2BProductModel` | `b2bproducts` | `models/b2b-product.ts` | |
| `B2BUserModel` | `b2busers` | `models/b2b-user.ts` | |
| `B2BHomeSettingsModel` | `b2bhomesettings` | `models/home-settings.ts` | Explicit collection name |
| `B2BHomeTemplateModel` | `b2bhometemplates` | `models/home-template.ts` | Explicit collection name |
| `ImportJobModel` | `importjobs` | `models/import-job.ts` | |
| `ImportSourceModel` | `importsources` | `models/import-source.ts` | |
| `PageModel` | `pages` | `models/page.ts` | |
| `PIMProductModel` | `pimproducts` | `models/pim-product.ts` | |
| `ProductTemplateModel` | `producttemplates` | `models/product-template.ts` | |

### Database & Solr Core Naming

**Single Source of Truth**: `@/config/project.config.ts`

Both MongoDB database and Solr core use the same instance name derived from `VINC_TENANT_ID`:

```
Instance Name = vinc-${VINC_TENANT_ID}
Example: VINC_TENANT_ID=hidros-it → vinc-hidros-it
```

| Component | Name Resolution | Override |
|-----------|----------------|----------|
| MongoDB   | `vinc-${VINC_TENANT_ID}` | `VINC_MONGO_DB_OVERRIDE` |
| Solr Core | `vinc-${VINC_TENANT_ID}` | `SOLR_CORE` |

```bash
# .env.local
VINC_TENANT_ID=hidros-it          # → MongoDB: vinc-hidros-it, Solr: vinc-hidros-it
VINC_MONGO_URL=mongodb://...
SOLR_URL=http://localhost:8983/solr
SOLR_ENABLED=true
```

```typescript
// ✅ Correct - use project.config.ts
import { projectConfig, getSolrConfig } from '@/config/project.config';

const config = projectConfig();
console.log(config.mongoDatabase);  // vinc-hidros-it
console.log(config.solrCore);       // vinc-hidros-it
```

### Schema Field Naming

- Use **snake_case** for database field names
- Match field names with existing conventions
- Use consistent naming across all models

```typescript
// ✅ Correct
{
  entity_code: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  source_id: { type: String, required: true },
}

// ❌ Incorrect (mixed conventions)
{
  entityCode: { type: String },  // camelCase
  created_at: { type: Date },    // snake_case
  SourceID: { type: String },    // PascalCase
}
```

### Timestamps

Always use Mongoose timestamps with snake_case field names:

```typescript
{
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
}
```

### Indexes

Add indexes for frequently queried fields:
- Primary identifiers (entity_code, source_id, etc.)
- Status fields (status, isCurrent, etc.)
- Date fields used in sorting (created_at, published_at)
- Fields used in filtering (wholesaler_id, category_id)

```typescript
// Single field indexes
entity_code: { type: String, required: true, index: true }

// Compound indexes
schema.index({ entity_code: 1, version: 1 });
schema.index({ wholesaler_id: 1, status: 1, completeness_score: -1 });
```

---

## File & Directory Structure

### Model Files

Location: `src/lib/db/models/`

Naming: Use **kebab-case** for file names
- `import-source.ts` (not `importSource.ts` or `import_source.ts`)
- `pim-product.ts`
- `import-job.ts`

Structure:
```typescript
// 1. Imports
import mongoose, { Schema, Document } from "mongoose";

// 2. Interface
export interface IModelName extends Document {
  // fields...
}

// 3. Schema
const ModelNameSchema = new Schema<IModelName>({
  // schema definition
}, {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

// 4. Indexes
ModelNameSchema.index({ field: 1 });

// 5. Export
export const ModelNameModel =
  mongoose.models.ModelName ||
  mongoose.model<IModelName>("ModelName", ModelNameSchema);
```

### API Routes

Location: `src/app/api/`

Conventions:
- Use folder structure for URL paths
- Use `route.ts` for route handlers
- Support async params in Next.js 15

```typescript
// ✅ Correct: src/app/api/b2b/pim/sources/[source_id]/trigger/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  const { source_id } = await params;
  // ...
}

// ❌ Incorrect: Not awaiting params
const { source_id } = params;  // Error in Next.js 15
```

---

## TypeScript & Code Style

### Shared Types Location

**ALL shared types live in `src/lib/types/`** - this is the single source of truth.

```
src/lib/types/
  ├── index.ts              ← Barrel export (import from "@/lib/types")
  ├── pim.ts                ← PIM types: MultiLangString, ProductImage, etc.
  ├── search.ts             ← Search/Solr types: SearchRequest, FacetResults, etc.
  └── entities/             ← Entity types for embedding in products
      ├── index.ts
      ├── brand.types.ts    ← BrandEmbedded, BrandDocument
      ├── category.types.ts ← CategoryEmbedded, CategoryDocument
      ├── collection.types.ts
      ├── product-type.types.ts
      └── tag.types.ts
```

**Exception:** Mongoose document interfaces (`I*`) stay with their schemas in `src/lib/db/models/*.ts`.

| Type Category | Location | Description |
|--------------|----------|-------------|
| **PIM types** | `src/lib/types/pim.ts` | `MultiLangString`, `MultilingualText`, `ProductImage`, `getLocalizedString()` |
| **Search types** | `src/lib/types/search.ts` | `SearchRequest`, `FacetResults`, `SolrProduct`, etc. |
| **Entity types** | `src/lib/types/entities/` | `BrandEmbedded`, `CategoryEmbedded`, `CollectionEmbedded`, etc. |
| **Mongoose interfaces** | `src/lib/db/models/*.ts` | `IPIMProduct`, `IImportJob`, etc. (stay with schemas) |

#### Example: Correct Usage

```typescript
// ✅ CORRECT: Import from centralized location
import { MultiLangString, getLocalizedString, ProductImage } from "@/lib/types/pim";
import { SearchRequest, FacetResults } from "@/lib/types/search";
import { BrandEmbedded, CategoryEmbedded } from "@/lib/types/entities";

// OR use barrel export
import { MultiLangString, SearchRequest, BrandEmbedded } from "@/lib/types";

type Product = {
  _id: string;
  name: MultiLangString;
  images?: ProductImage[];
};
```

#### Example: Incorrect Usage

```typescript
// ❌ INCORRECT: Defining types inline in page component
type MultiLangString = string | { [lang: string]: string };  // Don't redefine!

// ❌ INCORRECT: Importing from old locations
import { SearchRequest } from "@/lib/search/types";           // OLD - use @/lib/types/search
import { BrandEmbedded } from "@/lib/db/models/types";        // OLD - use @/lib/types/entities
```

#### Key Shared Types

**`src/lib/types/pim.ts`:**
| Type | Description |
|------|-------------|
| `MultiLangString` | `string \| { [lang: string]: string }` - flexible multilingual |
| `MultilingualText` | `Record<string, string>` - strict multilingual (always object) |
| `getLocalizedString()` | Helper to extract localized string (it → en → first value) |
| `ProductImage` | Product image with url, cdn_key, position, etc. |
| `ProductStatus` | `"draft" \| "published" \| "archived"` |

**`src/lib/types/search.ts`:**
| Type | Description |
|------|-------------|
| `SearchRequest` | Search API request parameters |
| `SearchResponse` | Search API response with results |
| `FacetRequest` | Facet-only request parameters |
| `FacetResults` | Facet values with counts |
| `SolrProduct` | Enriched product from Solr |

**`src/lib/types/entities/`:**
| Type | Description |
|------|-------------|
| `BrandEmbedded` | Brand data embedded in products |
| `CategoryEmbedded` | Category with hierarchy |
| `CollectionEmbedded` | Collection with hierarchy |
| `ProductTypeEmbedded` | Product type with features |
| `TagEmbedded` | Tag with group data |

### Interfaces

- Use `I` prefix for document interfaces that extend Mongoose `Document`
- Use descriptive names without prefixes for pure TypeScript types

```typescript
// ✅ Mongoose document interface
export interface IImportSource extends Document {
  source_id: string;
}

// ✅ Pure TypeScript type
export type ImportJobStatus = "pending" | "processing" | "completed" | "failed";
```

### Type Safety

- Always define proper types for function parameters
- Use TypeScript's strict mode
- Avoid `any` when possible, use `unknown` or proper types

```typescript
// ✅ Correct
interface ImportJobData {
  job_id: string;
  source_id: string;
  wholesaler_id: string;
  api_config?: {
    endpoint: string;
    method: "GET" | "POST";
  };
}

// ❌ Incorrect
function processJob(data: any) { }  // Too loose
```

---

## API Route Conventions

### Response Format

Successful responses:
```typescript
return NextResponse.json({
  success: true,
  data: result,
  message: "Operation completed successfully"
});
```

Error responses:
```typescript
return NextResponse.json(
  {
    error: "Error message",
    details: errorObject  // optional
  },
  { status: 400 }
);
```

### HTTP Status Codes

- `200` - Success with data
- `201` - Created
- `400` - Bad request (validation error)
- `404` - Not found
- `500` - Internal server error

---

## Public API Endpoints

Public endpoints are accessible without authentication and are intended for storefront consumption.

### Location

All public endpoints are located at: `src/app/api/public/`

### Available Public Endpoints

#### Menu API

**Endpoint**: `GET /api/public/menu`

Returns navigation menu items for storefront rendering.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | `"header" \| "footer" \| "mobile"` | No | Filter by menu location |

**Response**:
```typescript
{
  success: boolean;
  menuItems: MenuTreeItem[];  // Hierarchical tree structure
  flat: MenuItem[];           // Flat list for flexibility
}

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

**Example Usage**:
```bash
# Get all menus
curl "http://localhost:3001/api/public/menu"

# Get header menu only
curl "http://localhost:3001/api/public/menu?location=header"

# Get footer menu only
curl "http://localhost:3001/api/public/menu?location=footer"
```

**Features**:
- Only returns active menu items (`is_active: true`)
- Respects time-bound visibility (`start_date`, `end_date`)
- Returns hierarchical tree structure with nested `children`
- Also provides flat list for alternative rendering approaches

---

## Component Standards

### React Components

- Use functional components with TypeScript
- Define prop interfaces
- Use descriptive names

```typescript
interface ProductCardProps {
  product: Product;
  onSelect?: (id: string) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  // component logic
}
```

### State Management

- Use `useState` for local state
- Use Zustand stores for global state (pageBuilderStore)
- Keep state close to where it's used

---

## Environment Variables

### Naming Convention

Use `VINC_` prefix for project-specific variables:

```bash
# Database
VINC_MONGO_URL=mongodb://localhost:27017
VINC_MONGO_DB=hdr-api-it

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Required Variables

Document all required environment variables in `.env.example`:

```bash
# MongoDB Connection
VINC_MONGO_URL=
VINC_MONGO_DB=hdr-api-it

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

---

## Solr Configuration

### Single Source of Truth

**All Solr configuration lives in `@/config/project.config.ts`** - this is the single source of truth.

```typescript
// ✅ CORRECT: Import Solr config from project.config
import { getSolrConfig, isSolrEnabled, SolrConfig } from '@/config/project.config';

// Check if Solr is enabled
if (isSolrEnabled()) {
  const config = getSolrConfig();
  console.log(`Solr URL: ${config.url}`);
  console.log(`Solr Core: ${config.core}`);
}
```

```typescript
// ❌ INCORRECT: Don't import from facet-config (old location)
import { getSolrConfig } from '@/lib/search/facet-config';  // OLD - moved to project.config
```

### Configuration Functions

| Function | Location | Description |
|----------|----------|-------------|
| `getSolrConfig()` | `@/config/project.config` | Returns Solr URL, core, and search settings |
| `isSolrEnabled()` | `@/config/project.config` | Checks if `SOLR_ENABLED=true` |

### SolrConfig Interface

```typescript
interface SolrConfig {
  url: string;         // SOLR_URL or default
  core: string;        // SOLR_CORE or derived from VINC_TENANT_ID
  defaultRows: number; // SEARCH_DEFAULT_ROWS (default: 20)
  maxRows: number;     // SEARCH_MAX_ROWS (default: 100)
  facetLimit: number;  // FACET_DEFAULT_LIMIT (default: 100)
  facetMinCount: number; // FACET_MIN_COUNT (default: 1)
}
```

### Environment Variables

```bash
# Core Solr settings
SOLR_ENABLED=true
SOLR_URL=http://localhost:8983/solr
SOLR_CORE=vinc-hidros-it  # Optional - auto-derived from VINC_TENANT_ID

# Search tuning
SEARCH_DEFAULT_ROWS=20
SEARCH_MAX_ROWS=100
FACET_DEFAULT_LIMIT=100
FACET_MIN_COUNT=1
```

### Core Name Resolution

The Solr core name is resolved in this order:
1. `SOLR_CORE` environment variable (if set)
2. `vinc-${VINC_TENANT_ID}` (derived from tenant)
3. Falls back to instance name

```bash
# Example: VINC_TENANT_ID=hidros-it → core = "vinc-hidros-it"
VINC_TENANT_ID=hidros-it
```

### File Organization

| File | Purpose |
|------|---------|
| `@/config/project.config.ts` | Solr connection config (`getSolrConfig`, `isSolrEnabled`) |
| `@/lib/search/facet-config.ts` | Facet field definitions, sort/filter mappings |
| `@/lib/search/solr-client.ts` | HTTP client for Solr queries |
| `@/lib/search/query-builder.ts` | Build Solr queries from search requests |

---

## Import/Export Standards

### PIM System

#### Field Mappings

Format: `Record<string, string>` (API field → PIM field)

```typescript
{
  "oarti": "entity_code",
  "carti": "sku",
  "darti": "name",
  "pa1arti": "price"
}
```

#### Required Fields

Core PIM fields that are always required (schema-level):
- `entity_code` - Unique product identifier
- `sku` - Stock keeping unit
- `name` - Product name
- `image` - Primary product image (with `id`, `thumbnail`, `original`)

Additional required fields can be specified per import source (user-defined).

#### Import Job Flow

1. Trigger endpoint creates job in database
2. Job added to BullMQ queue
3. Worker processes job (API or file import)
4. Results stored in database
5. Source stats updated

---

## Code Comments

### When to Comment

- Complex business logic
- Non-obvious algorithms
- Public API functions
- Architectural decisions

### Comment Style

```typescript
/**
 * Process import job from API or file source
 *
 * @param job - BullMQ job containing import configuration
 * @returns Promise with import results
 */
async function processImport(job: Job<ImportJobData>) {
  // Implementation...
}
```

---

## Testing Standards

### File Naming

- Test files: `*.test.ts` or `*.spec.ts`
- Mock data: `*.mock.ts`
- Test utilities: `test-utils.ts`

### Test Structure

```typescript
describe('ImportWorker', () => {
  describe('API Import', () => {
    it('should fetch and transform data from API', async () => {
      // Arrange
      const mockData = [...];

      // Act
      const result = await processImport(job);

      // Assert
      expect(result.successful).toBe(100);
    });
  });
});
```

---

## Git Commit Messages

### Format

```
type(scope): short description

Longer description if needed

- Bullet points for details
- Multiple changes listed
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

### Examples

```
feat(pim): add API import support for product sources

- Added api_config field to ImportSource model
- Created trigger endpoint for API imports
- Updated worker to handle both API and file imports
- Added default placeholder images for missing data

Closes #123
```

---

## Performance Standards

### Database Queries

- Always use indexes for frequently queried fields
- Limit results when possible
- Use projection to fetch only needed fields
- Avoid N+1 queries

```typescript
// ✅ Good - uses index, projection, limit
const products = await PIMProductModel
  .find({ wholesaler_id, status: "published" })
  .select('entity_code name image price')
  .limit(100)
  .lean();

// ❌ Bad - no limit, fetching all fields
const products = await PIMProductModel.find({});
```

### Image Optimization

- Use Next.js Image component
- Provide multiple sizes (thumbnail, medium, large, original)
- Use blur placeholders
- Lazy load below the fold

```typescript
<Image
  src={product.image.thumbnail}
  alt={product.name}
  width={48}
  height={48}
  quality={75}
  sizes="48px"
  priority={index < 5}
  placeholder={product.image.blur ? "blur" : "empty"}
  blurDataURL={product.image.blur}
/>
```

---

## Security Standards

### Authentication

- Use NextAuth for authentication
- Protect API routes with middleware
- Validate session tokens
- Use environment variables for secrets

### Data Validation

- Validate all user inputs
- Sanitize data before database insertion
- Use TypeScript for type safety
- Implement rate limiting for public APIs

### Secrets Management

- Never commit secrets to git
- Use environment variables
- Rotate secrets regularly
- Use different secrets for dev/prod

---

## Utility Scripts

### Location

Scripts are located in `scripts/` directory.

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `clear-products.ts` | `npx tsx scripts/clear-products.ts` | Clear all products from MongoDB and Solr |
| `seed-b2b-user.ts` | `npx tsx scripts/seed-b2b-user.ts` | Create B2B admin user |
| `create-test-source.ts` | `npx tsx scripts/create-test-source.ts` | Create test import source |
| `enable-italian-search.ts` | `npx tsx scripts/enable-italian-search.ts` | Enable Italian language for search |

### Clear Products Script

Deletes all products from MongoDB and Solr index:

```bash
cd vinc-apps/vinc-pim
npx tsx scripts/clear-products.ts
```

**What it clears:**
- MongoDB `pimproducts` collection
- Solr search index (all documents)

**Environment Variables:**
- `SOLR_URL` - Solr base URL (default: `http://localhost:8983/solr`)
- `SOLR_CORE` - Override Solr core name (default: `vinc-${VINC_TENANT_ID}`)
- `VINC_TENANT_ID` - Tenant ID used to derive database and Solr core names

---

## BMS to PIM Sync

### Location

Sync scripts are in `doc/export/bms-to-pim/`.

### Quick Start

```bash
cd doc/export/bms-to-pim

# Full sync (all steps)
./sync-all.sh

# With limit
./sync-all.sh --limit 100

# Single product
./sync-all.sh --entity-code 093412
```

### Sync Scripts

| Script | Source Table | PIM Fields |
|--------|--------------|------------|
| `01-sync-core.ts` | `myartmag`, `supervisor_*` | sku, name, description, variants |
| `02-sync-media.ts` | CDN/S3 | images, media |
| `03-sync-attributes.ts` | `myartcar` (FRET/FREV) | attributes |
| `04-sync-price-promo.ts` | `mypromor`, `mypromot` | promotions, promo_code, promo_type |

### Merge Modes

The PIM import API supports two modes:

- **`replace`** (default): Replaces entire product
- **`partial`**: Merges with existing data (delta update)

Scripts 03 and 04 use `partial` mode to preserve existing fields.

```typescript
// Partial update example
{
  source_id: "test-api-source",
  merge_mode: "partial",
  products: [{ entity_code: "093412", attributes: {...} }]
}
```

### Configuration

`config/connections.json`:
```json
{
  "projects": {
    "hidros-cloud": {
      "mysql": { "host": "...", "database": "mymb_hidros" },
      "mongodb": { "dbName": "hdr-api-it" }
    }
  },
  "defaultProject": "hidros-cloud"
}
```

---

## Email Configuration

### SMTP Settings

Email sending uses nodemailer with SMTP. Configuration is managed via environment variables.

**Environment Variables:**

```bash
# SMTP Configuration
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=noreply@example.com
MAIL_PASSWORD=your-password-here
MAIL_FROM=noreply@example.com
MAIL_FROM_NAME=Your Company Name

# Default recipient (for system notifications)
MAIL_TO=info@example.com
```

### Email Service Usage

The email service supports two modes:

1. **Queued (default)** - Emails are added to BullMQ queue for background processing
2. **Immediate** - Emails are sent synchronously

```typescript
import { sendEmail } from "@/lib/email";

// Queued (default) - recommended for most use cases
await sendEmail({
  to: "customer@example.com",
  subject: "Order Confirmation",
  html: "<h1>Your order has been confirmed</h1>",
});

// Immediate - for critical emails that must send now
await sendEmail({
  to: "customer@example.com",
  subject: "Password Reset",
  html: "<h1>Reset your password</h1>",
  immediate: true,
});
```

### Email Tracking

Emails have open and click tracking enabled by default:

```typescript
// Disable tracking for a specific email
await sendEmail({
  to: "customer@example.com",
  subject: "Privacy-sensitive email",
  html: "<p>Content</p>",
  tracking: false,
});
```

Tracking endpoints:

- Open tracking: `GET /api/email/track/open/[emailId]` (returns 1x1 pixel)
- Click tracking: `GET /api/email/track/click/[emailId]?url=...` (redirects to URL)

### Email Worker

Run the email worker to process queued emails:

```bash
# Development
pnpm worker:email

# Production
pnpm worker:email:prod

# All workers together
pnpm worker:all
```

### Email Log Model

All emails are logged in the `emaillogs` collection with:

- Delivery status (queued, sending, sent, failed, bounced)
- Open tracking (count, timestamps, IP, user agent)
- Click tracking (URLs clicked, timestamps, IP, user agent)
- Metadata and tags for filtering

---

## Maintenance

### Updating Standards

When updating these standards:
1. Document the change with rationale
2. Update all affected code
3. Communicate changes to team
4. Update this document

### Questions

For questions about these standards, refer to:
- Project architecture documentation
- MongoDB Mongoose documentation
- Next.js 15 documentation
- TypeScript handbook

---

**Last Updated**: 2025-12-04
**Version**: 1.2
