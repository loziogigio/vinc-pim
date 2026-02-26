# CLAUDE.md - Project Guidelines for AI Assistance

This file provides context for Claude Code when working on the VINC Commerce Suite.

## Project Overview

VINC Commerce Suite is a Next.js 15 B2B e-commerce platform with:
- PIM (Product Information Management)
- Home page builder with live preview
- Solr-powered search and faceting
- MongoDB for data persistence
- BullMQ for background job processing

## Development Mode

**IMPORTANT:** During development, do NOT run `npm run build` to verify changes. The user runs in dev mode (`npm run dev`) which provides hot reloading and immediate feedback. Only run builds when explicitly requested.

## Core Maintenance Standards

These three principles are the foundation of all code in this project. Every implementation decision should be evaluated against them.

### 1. Readability

Code should be self-explanatory and easy to understand at a glance.

**Guidelines:**

- Use descriptive variable and function names that reveal intent
- Keep functions small and focused on a single responsibility
- Use consistent formatting and naming conventions
- Add comments only when the "why" isn't obvious from the code
- Avoid clever tricks - prefer explicit over implicit

```typescript
// BAD: Cryptic and hard to follow
const r = await db.find({ s: "a", t: { $gt: d - 86400000 } });

// GOOD: Clear intent
const activeOrdersLastDay = await OrderModel.find({
  status: "active",
  created_at: { $gt: oneDayAgo },
});
```

### 2. Reusability

Extract common patterns into shared utilities to avoid reinventing solutions.

**Guidelines:**

- Create utility functions for repeated operations
- Use shared types and interfaces from `src/lib/types/`
- Build composable components and hooks
- Centralize configuration in `src/config/`
- Use constants from `src/lib/constants/` for shared values

```typescript
// BAD: Duplicated pagination logic in every route
const page = parseInt(searchParams.get("page") || "1");
const limit = parseInt(searchParams.get("limit") || "20");
const skip = (page - 1) * limit;

// GOOD: Shared utility
import { parsePagination } from "@/lib/utils/pagination";
const { page, limit, skip } = parsePagination(searchParams);
```

**Key reusable locations:**
- `src/lib/utils/` - Utility functions
- `src/lib/types/` - Shared TypeScript types
- `src/lib/constants/` - Constants and enumerations
- `src/lib/db/` - Database utilities and models
- `src/components/shared/` - Reusable UI components

### 3. No Duplication (DRY)

Every piece of knowledge should have a single, authoritative source.

**Guidelines:**

- Single source of truth for types, constants, and configuration
- Extract duplicated code into shared functions
- Use barrel exports (`index.ts`) for clean imports
- When you copy-paste code, stop and refactor

```typescript
// BAD: Same validation logic in 3 different routes
if (!email || !email.includes("@")) { ... }

// GOOD: Single validation utility
import { validateEmail } from "@/lib/validation";
if (!validateEmail(email)) { ... }
```

**Anti-patterns to avoid:**

- Copying code between files instead of extracting shared utility
- Defining the same type in multiple files
- Hard-coding the same magic value in multiple places
- Creating similar components that could be parameterized

### 4. Separation of Concerns

Each module, function, or component should have one clear responsibility.

**Guidelines:**

- Business logic belongs in services (`src/lib/services/`)
- Database operations belong in models (`src/lib/db/models/`)
- API routes should be thin orchestrators, not contain business logic
- UI components handle presentation, not data fetching
- Utility functions should be pure when possible

```typescript
// BAD: API route doing everything
export async function POST(req) {
  const data = await req.json();
  // 50 lines of validation...
  // 30 lines of business logic...
  // 20 lines of database operations...
  return NextResponse.json(result);
}

// GOOD: Separated concerns
export async function POST(req) {
  const data = await req.json();
  const validated = validateOrderInput(data);     // Validation layer
  const result = await orderService.create(validated); // Service layer
  return NextResponse.json(result);
}
```

### 5. File Size Management

Don't let single files grow too large. Large files are hard to navigate and maintain.

**Guidelines:**

- **Target:** Keep files under 300-400 lines
- **Warning:** Files over 500 lines should be refactored
- **Critical:** Files over 800 lines must be split
- Split by functionality, not arbitrarily
- Extract related functions into separate modules
- Use barrel exports (`index.ts`) to maintain clean imports

**When to split:**

- Multiple unrelated responsibilities in one file
- Scrolling becomes necessary to understand the file
- Tests become difficult to write or maintain
- Multiple developers frequently have merge conflicts

### Applying the Standards

When writing or reviewing code, ask:

1. **Readability**: Can a new developer understand this in 30 seconds?
2. **Reusability**: Is this pattern used elsewhere? Should it be shared?
3. **No Duplication**: Does this duplicate existing code or knowledge?
4. **Separation of Concerns**: Does this module have one clear responsibility?
5. **File Size**: Is this file getting too large?

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

### API Route Authentication (ALWAYS use `requireTenantAuth`)

**Every B2B API route MUST use `requireTenantAuth` from `src/lib/auth/tenant-auth.ts`** as the default authentication method. It supports all clients (browser session, API key, Bearer JWT) without any extra code.

```typescript
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response; // 401 handled automatically

  const { tenantDb, tenantId, userId } = auth;
  const { MyModel } = await connectWithModels(tenantDb);

  // ... business logic
}
```

**Why `requireTenantAuth` instead of `getB2BSession`:**

|                                 | `getB2BSession()` | `requireTenantAuth()` |
| ------------------------------- | ----------------- | --------------------- |
| Browser session                 | ✅                | ✅                    |
| API key (external integrations) | ❌                | ✅                    |
| Bearer JWT (mobile apps)        | ❌                | ✅                    |
| Returns 401 automatically       | ❌ (manual)       | ✅                    |

**If you need the user's identity** (e.g. the route is user-specific):

```typescript
const auth = await requireTenantAuth(req, { requireUserId: true });
if (!auth.success) return auth.response;

const { tenantDb, userId } = auth; // userId guaranteed non-null
```

**Never** call `getB2BSession()` or `verifyAPIKeyFromRequest()` directly in new API routes — always go through `requireTenantAuth`.

Exception: internal server-side helpers (e.g. cron jobs, workers) that don't receive HTTP requests.

### Search (SolrCloud)

This project uses **SolrCloud** (not standalone Solr). Key differences:

- Uses **collections** instead of cores
- Collection naming: `vinc-${tenant_id}` (e.g., `vinc-hidros-it`)
- Config set: `_default` (SolrCloud default)

**Environment variable:**
```bash
SOLR_URL=http://149.81.163.109:8983/solr
```

**Admin API endpoints:**
```bash
# List all collections
curl "$SOLR_URL/admin/collections?action=LIST"

# Check if collection exists
curl "$SOLR_URL/admin/collections?action=LIST" | jq '.collections | index("vinc-hidros-it")'

# Create collection
curl "$SOLR_URL/admin/collections?action=CREATE&name=vinc-tenant-id&numShards=1&replicationFactor=1&collection.configName=_default"

# Delete collection (SolrCloud - use collections API, not cores API)
curl "$SOLR_URL/admin/collections?action=DELETE&name=vinc-tenant-id"

# Check collection status
curl "$SOLR_URL/admin/collections?action=CLUSTERSTATUS&collection=vinc-tenant-id"
```

**Important:** SolrCloud uses **collections API**, not cores API. When deleting:
- ✅ Use: `/admin/collections?action=DELETE&name=vinc-tenant-id`
- ❌ Don't use: `/admin/cores?action=UNLOAD&core=vinc-tenant-id` (standalone Solr only)

The tenant service (`src/lib/services/admin-tenant.service.ts`) handles this automatically with proper fallback logic.

Key files:
- `@/config/project.config.ts` - Solr connection config
- `@/lib/search/facet-config.ts` - Facet field definitions
- `@/lib/search/solr-client.ts` - HTTP client
- `@/lib/search/query-builder.ts` - Query building
- `@/lib/services/admin-tenant.service.ts` - Tenant provisioning/deletion with Solr collection management

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

### Decimal Input Fields

For numeric inputs that need to support decimal values (prices, quantities, etc.), use the **dual-state pattern** with both a string input value and a numeric value. This allows users to:

- Clear the field completely and type a new value
- Type partial decimals like "25." before completing with "25.50"
- Use comma as decimal separator (Italian keyboard friendly)

**Pattern:**

```typescript
// State includes both numeric value and string input
interface EditingState {
  quantity: number;
  quantityInput: string;  // String for input display
  unitPrice: number;
  unitPriceInput: string; // String for input display
}

// Initialize with string representation
function startEditing(item: Item) {
  setEditing({
    quantity: item.quantity,
    quantityInput: String(item.quantity),
    unitPrice: item.unit_price,
    unitPriceInput: String(item.unit_price),
  });
}

// Update from +/- buttons (updates both values)
function updateQuantity(quantity: number) {
  if (!editing) return;
  const newQty = Math.max(0, quantity);
  setEditing({ ...editing, quantity: newQty, quantityInput: String(newQty) });
}

// Update from text input (allows typing decimals)
function updateQuantityInput(value: string) {
  if (!editing) return;
  // Replace comma with dot for decimal (Italian keyboard support)
  const normalizedValue = value.replace(",", ".");
  // Allow empty, partial decimals like "1." or just numbers
  if (normalizedValue === "" || /^[0-9]*\.?[0-9]*$/.test(normalizedValue)) {
    const parsed = parseFloat(normalizedValue);
    setEditing({
      ...editing,
      quantityInput: normalizedValue,
      quantity: isNaN(parsed) ? 0 : parsed,
    });
  }
}
```

**Input field:**

```tsx
<input
  type="text"
  inputMode="decimal"
  value={editing.quantityInput}
  onChange={(e) => updateQuantityInput(e.target.value)}
/>
```

**Key points:**

- Use `type="text"` with `inputMode="decimal"` (not `type="number"`)
- Store string value for display, numeric value for calculations
- Regex `/^[0-9]*\.?[0-9]*$/` allows empty, partial, and complete decimals
- Replace comma with dot for Italian/European keyboard compatibility
- Parse to number on every change, default to 0 if invalid

### Database Queries

```typescript
// Good - uses index, projection, limit
const products = await PIMProductModel
  .find({ wholesaler_id, status: "published" })
  .select('entity_code name image price')
  .limit(100)
  .lean();
```

### Multi-Tenant Database Access

This is a **multi-tenant application** where each tenant has its own database (`vinc-{tenant-id}`). Database access patterns must support concurrent requests to different tenant databases.

**Architecture:**

```
┌─────────────────────────────────────────┐
│  Connection Pool (LRU, max 50)          │
│  ┌─────────────────────────────────┐    │
│  │ vinc-tenant-a  → Connection     │    │
│  │ vinc-tenant-b  → Connection     │    │
│  │ vinc-tenant-c  → Connection     │    │
│  │ ... (reused via useDb())        │    │
│  └─────────────────────────────────┘    │
│                                          │
│  Admin DB: vinc-admin (separate)         │
└─────────────────────────────────────────┘
```

**Key Files:**

- `src/lib/db/connection-pool.ts` - LRU-based connection pool
- `src/lib/db/model-registry.ts` - Tenant-specific model provider
- `src/lib/db/connection.ts` - Connection utilities
- `src/lib/db/admin-connection.ts` - Admin database (separate)

#### Pattern 1: Mongoose Models (Recommended)

Use `connectWithModels()` for Mongoose model access with full pooling support:

```typescript
import { connectWithModels } from "@/lib/db/connection";

export async function GET(req: NextRequest) {
  const session = await getB2BSession();
  const dbName = `vinc-${session.tenantId}`;

  // Get models bound to the correct tenant connection
  const { Customer, Order } = await connectWithModels(dbName);

  // Models are now tenant-specific
  const customers = await Customer.find({ status: "active" }).lean();
  const orders = await Order.find({ customer_id: id }).lean();

  return NextResponse.json({ customers, orders });
}
```

#### Pattern 2: Raw MongoDB Collections

For direct MongoDB access (no Mongoose validation/middleware):

```typescript
import { getPooledConnection } from "@/lib/db/connection";

export async function GET(req: NextRequest) {
  const session = await getB2BSession();
  const dbName = `vinc-${session.tenantId}`;

  // Get pooled connection
  const connection = await getPooledConnection(dbName);
  const db = connection.db;

  // Access raw collections
  const products = await db.collection("pimproducts")
    .find({ status: "published" })
    .limit(100)
    .toArray();

  return NextResponse.json({ products });
}
```

#### Pattern 3: Admin Database

For super-admin operations (tenant management, etc.):

```typescript
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { getTenantModel } from "@/lib/db/models/admin-tenant";

export async function GET(req: NextRequest) {
  // Admin connection is completely separate from tenant pool
  await connectToAdminDatabase();

  const TenantModel = await getTenantModel();
  const tenants = await TenantModel.find({ status: "active" }).lean();

  return NextResponse.json({ tenants });
}
```

**Anti-Patterns:**

```typescript
// BAD: Global models don't respect connection pooling
import { CustomerModel } from "@/lib/db/models/customer";
await connectToDatabase(dbName);
const customers = await CustomerModel.find({});  // May use wrong connection!

// GOOD: Use connectWithModels for proper tenant isolation
const { Customer } = await connectWithModels(dbName);
const customers = await Customer.find({});  // Always correct tenant
```

#### Connection Pool Settings

| Variable                     | Default   | Description                      |
| ---------------------------- | --------- | -------------------------------- |
| `VINC_POOL_MAX_CONNECTIONS`  | 50        | Max tenant connections in pool   |
| `VINC_POOL_PER_DB_SIZE`      | 10        | MongoDB pool size per connection |
| `VINC_POOL_TTL_MS`           | 1800000   | Connection TTL (30 min)          |

## Best Practices

### Things to NEVER Do

- **Client-side pagination**: Never load all items and paginate in React. This causes performance issues with large datasets and wastes bandwidth/memory.
- **Hard-coded magic values**: Never use raw strings/numbers directly in code. See "Constants & Enumerations" section below.
- **Co-Authored-By in commits**: Never add `Co-Authored-By: Claude ...` or similar attribution lines to git commit messages.
- **Company-specific API keys in documentation**: Never use real tenant names like `ak_hidros-it_...` in API documentation. Always use generic placeholders like `ak_{tenant-id}_{key-suffix}` and `sk_{secret}`. Real test keys should only appear in CLAUDE.md's "Multi-Tenant API Testing" section for internal testing purposes.

### Constants & Enumerations

**NEVER hard-code values directly in business logic.** Use typed constants and enumerations for maintainability, type safety, and refactoring support.

#### Location for Constants

```
src/lib/constants/
  ├── index.ts              # Barrel export
  ├── order.ts              # Order-related constants
  ├── customer.ts           # Customer-related constants
  └── common.ts             # Shared constants (currencies, countries, etc.)
```

#### Pattern 1: String Literal Union Types (Preferred for simple enums)

```typescript
// src/lib/constants/order.ts

// Define allowed values as const array (single source of truth)
export const ORDER_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

// Derive type from array
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Optional: Human-readable labels
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft (Cart)",
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Usage in code:
import { ORDER_STATUSES, OrderStatus, ORDER_STATUS_LABELS } from "@/lib/constants/order";

// Type-safe function parameter
function updateOrderStatus(orderId: string, status: OrderStatus) { ... }

// Validation
if (!ORDER_STATUSES.includes(status)) {
  throw new Error(`Invalid status: ${status}`);
}

// UI dropdown
ORDER_STATUSES.map(status => (
  <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>
))
```

#### Pattern 2: Object Constants (For related values)

```typescript
// src/lib/constants/customer.ts

export const CUSTOMER_TYPES = {
  BUSINESS: "business",
  PRIVATE: "private",
  RESELLER: "reseller",
} as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[keyof typeof CUSTOMER_TYPES];

// With metadata
export const CUSTOMER_TYPE_CONFIG = {
  business: {
    label: "Business",
    icon: "Building2",
    color: "emerald",
    requiresVAT: true,
  },
  private: {
    label: "Private",
    icon: "User",
    color: "purple",
    requiresVAT: false,
  },
  reseller: {
    label: "Reseller",
    icon: "Store",
    color: "amber",
    requiresVAT: true,
  },
} as const;
```

#### Pattern 3: Numeric Constants

```typescript
// src/lib/constants/common.ts

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const VAT_RATES = {
  STANDARD: 22,
  REDUCED: 10,
  SUPER_REDUCED: 4,
  ZERO: 0,
} as const;

export type VatRate = (typeof VAT_RATES)[keyof typeof VAT_RATES];

// Code prefix patterns
export const CODE_PREFIXES = {
  CUSTOMER_PUBLIC: "C-",
  ORDER: "ORD-",
  CART: "CART-",
  INVOICE: "INV-",
} as const;
```

#### Pattern 4: Mongoose Schema with Constants

```typescript
// In model file
import { ORDER_STATUSES } from "@/lib/constants/order";

const OrderSchema = new Schema({
  status: {
    type: String,
    enum: ORDER_STATUSES,  // Use constant array
    default: "draft",
  },
});
```

#### What to Extract as Constants

| Extract                                   | Don't Extract                      |
| ----------------------------------------- | ---------------------------------- |
| Status values (order, customer, payment)  | One-time configuration values      |
| Type classifications                      | Values from environment variables  |
| VAT rates, currencies                     | Truly unique identifiers           |
| Error codes and messages                  | CSS class names (use Tailwind)     |
| API endpoints (if reused)                 | Component-specific UI strings      |
| Pagination defaults                       |                                    |
| Code prefixes (C-, ORD-, etc.)            |                                    |

#### Anti-Patterns to Avoid

```typescript
// BAD: Magic strings scattered in code
if (order.status === "confirmed") { ... }
const vat = price * 0.22;

// BAD: Duplicated values
// file1.ts: status: "pending"
// file2.ts: status: "pending"  // Easy to typo as "Pending"

// BAD: Type assertions without validation
const status = input as OrderStatus;  // No runtime check!

// GOOD: Centralized constants with type safety
import { OrderStatus, VAT_RATES } from "@/lib/constants";

if (order.status === "confirmed") { ... }  // TypeScript knows valid values
const vat = price * (VAT_RATES.STANDARD / 100);

// GOOD: Runtime validation
function isValidStatus(s: string): s is OrderStatus {
  return ORDER_STATUSES.includes(s as OrderStatus);
}
```

### Things to ALWAYS Do

- **Server-side pagination via API**: Always implement pagination at the API level. The API should accept `page` and `limit` (or `pageSize`) parameters and return paginated results with metadata.

```typescript
// API Route - Server-side pagination
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";

  const skip = (page - 1) * limit;

  // Build query with optional search filter
  const query: Record<string, unknown> = {};
  if (search) {
    query.$or = [
      { entity_code: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Model.find(query).skip(skip).limit(limit).lean(),
    Model.countDocuments(query),
  ]);

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

```typescript
// React Component - Consuming paginated API
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(20);
const [search, setSearch] = useState("");

const { data, isLoading } = useSWR(
  `/api/items?page=${page}&limit=${pageSize}&search=${search}`
);

// Render pagination controls using data.pagination.totalPages
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
  │   ├── navigation/    # Shared navigation components
  │   ├── layouts/       # Shared layout components
  │   └── pim/           # PIM components
  ├── config/
  │   └── apps.config.ts # Centralized app registry
  ├── lib/
  │   ├── db/            # Database connection & models
  │   ├── search/        # Solr search utilities
  │   ├── types/         # Shared TypeScript types
  │   └── security/      # Auth & validation
  └── test/
      └── unit/          # Unit tests (Vitest)
```

## Development Workflow

### Git Branch Strategy

```
Feature Branch → Main → Delete Branch

1. Create feature branch from main:
   git checkout main
   git pull
   git checkout -b feature/{feature-name}

2. Implement changes
3. Write unit tests in src/test/unit/
4. Run tests: npm test
5. Commit with descriptive message:
   git add .
   git commit -m "feat: description of changes"

6. Merge to main:
   git checkout main
   git merge feature/{feature-name}

7. Push main:
   git push origin main

8. Delete feature branch (local + remote):
   git branch -d feature/{feature-name}
   git push origin --delete feature/{feature-name}
```

### Unit Testing

Tests are located in `src/test/unit/` and use Vitest.

```bash
# Run all tests
npm test

# Run specific test file
npm test -- apps-config.test.ts

# Run tests in watch mode
npm test -- --watch
```

**Test file naming:** `{feature-name}.test.ts`

## New Application Development

When adding a new B2B application, follow this pattern:

### Step 1: Register in App Registry

Add the app to `src/config/apps.config.ts`:

```typescript
// In the APPS array
{
  id: "new-app",
  name: "New App",
  description: "Description here",
  href: "/b2b/new-app",
  icon: IconComponent,  // from lucide-react
  color: "bg-blue-500",
  showInLauncher: true,
  showInHeader: true,
  hasNavigation: true,  // true if app has sidebar navigation
}
```

This automatically:

- Adds the app to the App Launcher dropdown
- Adds the app to the header section detection
- Enables proper path matching for tenant prefixes

### Step 2: Create Folder Structure

```
src/app/b2b/(protected)/new-app/
├── layout.tsx           # Uses AppLayout + Navigation
├── page.tsx             # Main dashboard page
└── sub-section/
    └── page.tsx         # Sub-section pages
```

### Step 3: Create Navigation (if hasNavigation: true)

```typescript
// src/components/new-app/NewAppNavigation.tsx
"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import { LayoutDashboard, Folder, Settings } from "lucide-react";

export function NewAppNavigation() {
  return (
    <AppSidebar title="New App">
      <NavLink href="/b2b/new-app" icon={LayoutDashboard} label="Dashboard" />
      <NavLink href="/b2b/new-app/items" icon={Folder} label="Items" />
      <NavLink href="/b2b/new-app/settings" icon={Settings} label="Settings" />
    </AppSidebar>
  );
}
```

### Step 4: Create Layout

```typescript
// src/app/b2b/(protected)/new-app/layout.tsx
import { AppLayout } from "@/components/layouts/AppLayout";
import { NewAppNavigation } from "@/components/new-app/NewAppNavigation";

export default function NewAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<NewAppNavigation />}>
      {children}
    </AppLayout>
  );
}
```

### Step 5: Create Main Page

```typescript
// src/app/b2b/(protected)/new-app/page.tsx
export default function NewAppPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">New App Dashboard</h1>
      {/* Content here */}
    </div>
  );
}
```

### Step 6: Write Unit Tests

```typescript
// src/test/unit/new-app.test.ts
import { describe, it, expect } from "vitest";
import { getAppById, getAppByPath } from "@/config/apps.config";

describe("unit: New App Config", () => {
  it("should be registered in app registry", () => {
    const app = getAppById("new-app");
    expect(app).toBeDefined();
    expect(app?.name).toBe("New App");
    expect(app?.href).toBe("/b2b/new-app");
  });

  it("should match path correctly", () => {
    const app = getAppByPath("/b2b/new-app/items");
    expect(app?.id).toBe("new-app");
  });

  it("should handle tenant-prefixed paths", () => {
    const app = getAppByPath("/tenant-id/b2b/new-app");
    expect(app?.id).toBe("new-app");
  });
});
```

### Shared Navigation Components

Use these reusable components from `src/components/navigation/`:

| Component    | Purpose                                     |
| ------------ | ------------------------------------------- |
| `NavLink`    | Navigation link with active state detection |
| `NavSection` | Collapsible section with items              |
| `AppSidebar` | Standard sidebar wrapper                    |

```typescript
import { NavLink, NavSection, AppSidebar } from "@/components/navigation";
```

### App Registry Helper Functions

Available in `src/config/apps.config.ts`:

| Function                      | Returns                                  |
| ----------------------------- | ---------------------------------------- |
| `getAppById(id)`              | App config by ID                         |
| `getAppByPath(pathname)`      | App config matching pathname             |
| `getLauncherApps()`           | Apps for App Launcher dropdown           |
| `getHeaderApps()`             | Apps for header display                  |
| `getCurrentSection(pathname)` | Current section info (name, icon, color) |

## Multi-Tenant API Testing

This project uses multi-tenant isolation with separate MongoDB databases per tenant (`vinc-{tenant-id}`).

### Test API Keys

Test keys are stored in `scripts/.test-api-keys.json`. To recreate them:

```bash
npx tsx scripts/create-test-api-keys.ts
```

**Fixed test credentials:**

| Tenant        | Key ID                             | Secret                                     |
| ------------- | ---------------------------------- | ------------------------------------------ |
| hidros-it     | `ak_hidros-it_aabbccddeeff`        | `sk_aabbccddeeff00112233445566778899`      |
| dfl-eventi-it | `ak_dfl-eventi-it_112233445566`    | `sk_112233445566778899aabbccddeeff00`      |

### API Key Authentication Headers

When using API key auth, include these headers:

```bash
-H "x-auth-method: api-key"
-H "x-api-key-id: ak_{tenant}_{12-hex-chars}"
-H "x-api-secret: sk_{32-hex-chars}"
```

### Testing Tenant Isolation

```bash
# Test hidros customers (should return data)
curl -s "http://localhost:3001/api/b2b/customers" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_hidros-it_aabbccddeeff" \
  -H "x-api-secret: sk_aabbccddeeff00112233445566778899" | jq '.customers | length'

# Test DFL customers (should return 0 - different tenant)
curl -s "http://localhost:3001/api/b2b/customers" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_dfl-eventi-it_112233445566" \
  -H "x-api-secret: sk_112233445566778899aabbccddeeff00" | jq '.customers | length'

# Test cross-tenant access (should be blocked)
curl -s "http://localhost:3001/api/b2b/orders/{hidros-order-id}" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_dfl-eventi-it_112233445566" \
  -H "x-api-secret: sk_112233445566778899aabbccddeeff00"
# Expected: {"error":"Order not found"}
```

### API Key Format

- **Key ID**: `ak_{tenant-id}_{12-hex-chars}` (e.g., `ak_hidros-it_aabbccddeeff`)
- **Secret**: `sk_{32-hex-chars}` (e.g., `sk_aabbccddeeff00112233445566778899`)
- Secrets are stored as bcrypt hashes in the `apikeys` collection

### Mobile App Authentication (Best Practice)

Mobile apps (Flutter/iOS/Android) should use **API key for tenant auth** + **Bearer token for user identity**. This follows the standard OAuth2 pattern.

**Required Headers:**

```
x-auth-method: api-key
x-api-key-id: ak_{tenant}_{key}
x-api-secret: sk_{secret}
Authorization: Bearer <portal-user-jwt>   // User identity (after login)
```

**Authentication Flow:**

1. **Before login**: Only send API key headers (tenant-level access)
2. **After login**: Add `Authorization: Bearer <jwt>` for user-specific endpoints

**Example (Flutter/Dart):**

```dart
class ApiService {
  final String baseUrl;
  final String apiKeyId;
  final String apiSecret;
  String? _portalUserToken;

  void setPortalUserToken(String token) => _portalUserToken = token;
  void clearPortalUserToken() => _portalUserToken = null;

  Map<String, String> get headers {
    final h = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-auth-method': 'api-key',
      'x-api-key-id': apiKeyId,
      'x-api-secret': apiSecret,
    };
    if (_portalUserToken != null) {
      h['Authorization'] = 'Bearer $_portalUserToken';
    }
    return h;
  }
}
```

**Backend Support:**

The `authenticateTenant()` function in `src/lib/auth/tenant-auth.ts` handles this by:
1. Validating API key for tenant context
2. Extracting `userId` from Bearer token (portal user JWT)
3. Returning both `tenantId` and `userId` in the auth result

**Portal User Token:**

- Generated by `/api/b2b/auth/portal-login` endpoint
- JWT containing `{ portalUserId, tenantId }`
- 7-day expiration
- Verified by `verifyPortalUserToken()` in `src/lib/auth/portal-user-token.ts`

**Endpoints requiring user identity:**

- `GET /api/b2b/notifications` - User's notifications
- `GET /api/b2b/orders` - User's orders
- `POST /api/b2b/fcm/register` - Register device for user
- Any endpoint using `requireTenantAuth(req, { requireUserId: true })`

### Key Files for Multi-Tenancy

- `src/lib/auth/api-key-auth.ts` - API key verification
- `src/lib/db/connection.ts` - Tenant database switching
- `src/middleware.ts` - Tenant resolution from URL path

## Debugging & Utility Scripts

### Checking Tenant Resources

Use `scripts/check-tenant.cjs` to verify tenant provisioning and deletion:

```bash
# Check if tenant exists and verify all resources
node scripts/check-tenant.cjs <tenant-id>

# Examples
node scripts/check-tenant.cjs hidros-it    # Should show all resources present
node scripts/check-tenant.cjs df-it        # After deletion, should show all resources removed
```

**What it checks:**
- Admin database record (in `vinc-admin` database)
- Tenant MongoDB database (`vinc-{tenant-id}`)
  - Collections list
  - Admin users count
  - Languages count (enabled vs total)
- Solr collection (`vinc-{tenant-id}`)

**Sample output:**
```
=== TENANT RESOURCE CHECK ===

Tenant ID: hidros-it
Expected DB: vinc-hidros-it
Expected Solr: vinc-hidros-it

✅ Tenant found in admin database
   Name: Hidros S.r.l
   Status: active
   Admin Email: admin@hidros.com
   Mongo DB: vinc-hidros-it
   Solr Core: vinc-hidros-it

✅ MongoDB database exists: vinc-hidros-it
   Collections: categories, languages, b2busers, ...
   Admin users: 2
   Languages: 43 total, 1 enabled

✅ Solr collection exists: vinc-hidros-it
   URL: http://149.81.163.109:8983/solr/#/vinc-hidros-it

=== SUMMARY ===
✅ Admin DB record
✅ MongoDB database
✅ Solr collection

✅ Tenant fully provisioned - all resources present
```

**Use cases:**
- Verify tenant creation completed successfully
- Check tenant deletion removed all resources
- Debug partial provisioning states
- Audit tenant infrastructure

### Other Utility Scripts

Pattern for creating check scripts (from `scripts/check-api-source.cjs`):

```javascript
#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  // Create flexible model with strict: false
  const Model = mongoose.models.ModelName || mongoose.model(
    'ModelName',
    new mongoose.Schema({}, { strict: false })
  );

  // Query and display data
  const doc = await Model.findOne({ /* query */ }).exec();
  console.log('Field:', doc.field);

  await mongoose.connection.close();
}

main().catch(console.error);
```

## Related Projects

- `vinc-b2b`: Customer-facing B2B storefront (separate Next.js app)
- Communication via postMessage for live preview between builder and storefront
