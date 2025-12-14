# CLAUDE.md - Project Guidelines for AI Assistance

This file provides context for Claude Code when working on the VINC Commerce Suite.

## Project Overview

VINC Commerce Suite is a Next.js 15 B2B e-commerce platform with:
- PIM (Product Information Management)
- Home page builder with live preview
- Solr-powered search and faceting
- MongoDB for data persistence
- BullMQ for background job processing

## Key Conventions

### MongoDB & Collections

- Collection names: **lowercase, no underscores, pluralized** (e.g., `pimproducts`, `importjobs`)
- Schema fields: **snake_case** (e.g., `entity_code`, `created_at`)
- Timestamps: Always use `{ createdAt: "created_at", updatedAt: "updated_at" }`
- Mongoose interfaces: Prefix with `I` (e.g., `IPIMProduct`, `IImportJob`)

### File Naming

- Model files: `src/lib/db/models/` with **kebab-case** (e.g., `pim-product.ts`)
- API routes: `src/app/api/` using folder structure for URL paths
- Types: `src/lib/types/` is the single source of truth for shared types

### TypeScript & Types

Shared types location:
```
src/lib/types/
  ├── index.ts          # Barrel export
  ├── pim.ts            # MultiLangString, ProductImage, etc.
  ├── search.ts         # SearchRequest, FacetResults, etc.
  ├── blocks.ts         # Page builder block types
  └── entities/         # BrandEmbedded, CategoryEmbedded, etc.
```

Import from centralized location:
```typescript
import { MultiLangString, ProductImage } from "@/lib/types/pim";
import { SearchRequest } from "@/lib/types/search";
import { BrandEmbedded } from "@/lib/types/entities";
```

### Configuration

Single source of truth: `@/config/project.config.ts`

```typescript
import { projectConfig, getSolrConfig, isSolrEnabled } from '@/config/project.config';
```

Database and Solr core naming:
- Instance name: `vinc-${VINC_TENANT_ID}` (e.g., `vinc-hidros-it`)
- Override with `VINC_MONGO_DB_OVERRIDE` or `SOLR_CORE`

### API Routes (Next.js 15)

Always await params in route handlers:
```typescript
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  const { source_id } = await params;  // Must await!
}
```

Response format:
```typescript
// Success
return NextResponse.json({ success: true, data: result });

// Error
return NextResponse.json({ error: "Message" }, { status: 400 });
```

### Search (Solr)

Key files:
- `@/config/project.config.ts` - Solr connection config
- `@/lib/search/facet-config.ts` - Facet field definitions
- `@/lib/search/solr-client.ts` - HTTP client
- `@/lib/search/query-builder.ts` - Query building

### React Components

- Functional components with TypeScript
- Define prop interfaces
- Use Zustand for global state (e.g., `pageBuilderStore`)
- Use `useState` for local state

### Environment Variables

Use `VINC_` prefix for project-specific variables:
```bash
VINC_MONGO_URL=mongodb://...
VINC_TENANT_ID=hidros-it
SOLR_ENABLED=true
SOLR_URL=http://localhost:8983/solr
```

## Common Patterns

### Avoiding Infinite Loops in React

When using callbacks in `useEffect`, use the ref pattern:
```typescript
const onSaveRef = useRef(onSave);
useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

useEffect(() => {
  // Use onSaveRef.current instead of onSave
  onSaveRef.current(data);
}, [data]);  // Don't include onSave in deps
```

### Database Queries

```typescript
// Good - uses index, projection, limit
const products = await PIMProductModel
  .find({ wholesaler_id, status: "published" })
  .select('entity_code name image price')
  .limit(100)
  .lean();
```

## Project Structure

```
src/
  ├── app/
  │   ├── api/           # API routes
  │   ├── b2b/           # B2B portal pages
  │   │   ├── (protected)/ # Pages requiring auth
  │   │   └── (builder)/   # Builder pages (minimal layout)
  ├── components/
  │   ├── builder/       # Home page builder components
  │   └── pim/           # PIM components
  ├── lib/
  │   ├── db/            # Database connection & models
  │   ├── search/        # Solr search utilities
  │   ├── types/         # Shared TypeScript types
  │   └── security/      # Auth & validation
  └── config/            # Project configuration
```

## Related Projects

- `vinc-b2b`: Customer-facing B2B storefront (separate Next.js app)
- Communication via postMessage for live preview between builder and storefront
