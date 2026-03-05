# CLAUDE.md - Project Guidelines for AI Assistance

## Project Overview

VINC Commerce Suite is a Next.js 15 B2B e-commerce platform with:

- PIM (Product Information Management)
- Home page builder with live preview
- Solr-powered search and faceting
- MongoDB for data persistence
- BullMQ for background job processing

**IMPORTANT:** During development, do NOT run `npm run build`. The user runs `npm run dev` with hot reloading. Only build when explicitly requested.

## Core Standards

1. **Readability** — Self-explanatory code, descriptive names, small focused functions
2. **Reusability** — Shared utilities in `src/lib/utils/`, types in `src/lib/types/`, constants in `src/lib/constants/`
3. **No Duplication (DRY)** — Single source of truth for types, constants, config. Extract shared code.
4. **Separation of Concerns** — Services in `src/lib/services/`, models in `src/lib/db/models/`, thin API routes
5. **File Size** — Target <400 lines. Warning >500. Must split >800.

## Key Conventions

### MongoDB & Collections

- Collection names: **lowercase, no underscores, pluralized** (e.g., `pimproducts`, `importjobs`)
- Schema fields: **snake_case** (e.g., `entity_code`, `created_at`)
- Timestamps: `{ createdAt: "created_at", updatedAt: "updated_at" }`
- Interfaces: Prefix with `I` (e.g., `IPIMProduct`)

### File Naming

- Models: `src/lib/db/models/` with **kebab-case** (e.g., `pim-product.ts`)
- API routes: `src/app/api/` using folder structure for URL paths
- Types: `src/lib/types/` — single source of truth

### TypeScript & Types

```text
src/lib/types/
  ├── index.ts          # Barrel export
  ├── pim.ts            # MultiLangString, ProductImage, etc.
  ├── search.ts         # SearchRequest, FacetResults, etc.
  ├── blocks.ts         # Page builder block types
  └── entities/         # BrandEmbedded, CategoryEmbedded, etc.
```

### Configuration

Single source of truth: `@/config/project.config.ts`

### API Routes (Next.js 15)

Always await params:
```typescript
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  const { source_id } = await params;  // Must await!
}
```

Response format: `{ success: true, data: result }` or `{ error: "Message" }` with status code.

### Authentication (ALWAYS use `requireTenantAuth`)

Every B2B API route MUST use `requireTenantAuth` from `src/lib/auth/tenant-auth.ts`. It supports browser sessions, API keys, and Bearer JWT.

```typescript
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const { MyModel } = await connectWithModels(tenantDb);
  // ... business logic
}
```

For user-specific routes: `requireTenantAuth(req, { requireUserId: true })`

**Never** call `getB2BSession()` or `verifyAPIKeyFromRequest()` directly in new routes.

### Search (SolrCloud)

Uses **collections** (not cores). Collection naming: `vinc-${tenant_id}`.

Key files:

- `@/config/project.config.ts` — Solr connection config
- `@/lib/search/facet-config.ts` — Facet field definitions
- `@/lib/search/solr-client.ts` — HTTP client
- `@/lib/search/query-builder.ts` — Query building
- `@/lib/services/admin-tenant.service.ts` — Tenant provisioning with Solr

**Important:** Use collections API (`/admin/collections?action=...`), not cores API.

### React Components

- Functional components with TypeScript, define prop interfaces
- Zustand for global state, `useState` for local state
- Use ref pattern to avoid infinite loops in `useEffect` with callbacks

### Environment Variables

`VINC_` prefix for project-specific: `VINC_MONGO_URL`, `VINC_TENANT_ID`, `SOLR_ENABLED`, `SOLR_URL`

## Multi-Tenant Database Access

Each tenant has its own database (`vinc-{tenant-id}`).

**Recommended pattern — Mongoose Models:**

```typescript
const { Customer, Order } = await connectWithModels(tenantDb);
const customers = await Customer.find({ status: "active" }).lean();
```

**Raw MongoDB:** `getPooledConnection(dbName)` for direct collection access.
**Admin DB:** `connectToAdminDatabase()` for super-admin operations.

**Anti-pattern:** Never import global models directly — always use `connectWithModels()`.

Key files: `connection-pool.ts`, `model-registry.ts`, `connection.ts`, `admin-connection.ts` (all in `src/lib/db/`)

| Variable                    | Default  | Description                      |
| --------------------------- | -------- | -------------------------------- |
| `VINC_POOL_MAX_CONNECTIONS` | 50       | Max tenant connections in pool   |
| `VINC_POOL_PER_DB_SIZE`     | 10       | MongoDB pool size per connection |
| `VINC_POOL_TTL_MS`          | 1800000  | Connection TTL (30 min)          |

## Common Patterns

### Decimal Input Fields

Use `src/lib/utils/decimal-input.ts`: `normalizeDecimalInput()`, `parseDecimalValue()`, `toDecimalInputValue()`.
Always use `type="text"` + `inputMode="decimal"` (NOT `type="number"`).

### Server-Side Pagination

Always paginate at the API level with `page` and `limit` params. Return `{ items, pagination: { page, limit, total, totalPages } }`.

### Constants & Enumerations

Never hard-code magic values. See `docs/claude/constants-guide.md` for patterns.

## Best Practices

### Things to NEVER Do

- Client-side pagination (always server-side)
- Hard-coded magic values (use constants)
- `Co-Authored-By` in commits
- Real tenant names in API documentation

### Things to ALWAYS Do

- Server-side pagination via API with `page`/`limit` params
- Use typed constants for statuses, types, rates
- Use `requireTenantAuth` for all B2B routes

## Project Structure

```text
src/
  ├── app/
  │   ├── api/           # API routes
  │   ├── b2b/           # B2B portal pages
  │   │   ├── (protected)/ # Pages requiring auth
  │   │   └── (builder)/   # Builder pages (minimal layout)
  ├── components/
  │   ├── builder/       # Home page builder components
  │   ├── navigation/    # Shared navigation components
  │   ├── layouts/       # Shared layout components
  │   └── pim/           # PIM components
  ├── config/
  │   └── apps.config.ts # Centralized app registry
  ├── lib/
  │   ├── db/            # Database connection & models
  │   ├── search/        # Solr search utilities
  │   ├── types/         # Shared TypeScript types
  │   ├── services/      # Business logic services
  │   ├── constants/     # Typed constants & enumerations
  │   └── auth/          # Authentication utilities
  └── test/
      └── unit/          # Unit tests (Vitest)
```

## Development Workflow

### Git

Feature branch -> Main -> Delete branch. Commit with `feat:`, `fix:`, `chore:` prefixes.

### Testing

Tests in `src/test/unit/` using Vitest. Run: `npm test`. Specific: `npm test -- file.test.ts`.

## Extended Guides (in `docs/claude/`)

- `docs/claude/constants-guide.md` — Constants & enumerations patterns with examples
- `docs/claude/new-app-guide.md` — Step-by-step new B2B application development
- `docs/claude/api-testing.md` — Multi-tenant API testing, test keys, mobile auth, debugging scripts

## Related Projects

- `vinc-b2b`: Customer-facing B2B storefront (separate Next.js app)
- Communication via postMessage for live preview between builder and storefront
