# Project Standards & Conventions

This document defines the coding standards, naming conventions, and architectural patterns used throughout the VINC Storefront project.

---

## Table of Contents

1. [MongoDB & Database Standards](#mongodb--database-standards)
2. [File & Directory Structure](#file--directory-structure)
3. [TypeScript & Code Style](#typescript--code-style)
   - [Shared Types Location](#shared-types-location)
4. [API Route Conventions](#api-route-conventions)
5. [Component Standards](#component-standards)

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

### Database Name

**Production Database**: `hdr-api-it`

All scripts, models, and connections should use this database unless explicitly configured otherwise.

```typescript
// ✅ Correct
const db = client.db('hdr-api-it');

// In .env.local
VINC_MONGO_DB=hdr-api-it
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

**Last Updated**: 2025-10-31
**Version**: 1.0
