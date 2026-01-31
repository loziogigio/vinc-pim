# Testing Standards for VINC Commerce Suite

Comprehensive testing standards for the Next.js 15 / TypeScript / Vitest project.

## Philosophy

Our testing approach follows these principles:

1. **Test behavior, not implementation** - Focus on what the code does, not how it does it
2. **Fast feedback loops** - Run tests frequently during development
3. **Confidence in deployment** - Tests should give confidence that production will work
4. **Maintainable tests** - Tests should be easy to understand and update
5. **Pragmatic coverage** - Aim for high coverage of critical paths, not 100% everywhere

## Test Pyramid

```
         /\
        /  \         E2E Tests (10-20%)
       /    \        - Playwright/Cypress
      /______\       - Critical user journeys
     /        \      - Real browser
    /          \     Integration Tests (20-30%)
   /            \    - API routes with DB
  /              \   - MongoDB in-memory
 /                \  - Real service interactions
/                  \ Unit Tests (50-70%)
____________________\- Fast, isolated
                     - Business logic
                     - No external dependencies
```

### Target Distribution

| Test Type | Percentage | Execution Time |
|-----------|------------|----------------|
| Unit | 60-70% | ~2 seconds |
| Integration | 20-30% | ~10 seconds |
| E2E | 10-20% | ~30 seconds |

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (fast, Vite-native) |
| **@testing-library/react** | React component testing |
| **mongodb-memory-server** | In-memory MongoDB for integration tests |
| **Playwright** | E2E browser testing (optional) |

---

## Test Types

### 1. Unit Tests

**What to test**:
- Business logic functions
- Data validation (Zod schemas)
- Calculations and transformations
- Edge cases and error conditions
- Pure utility functions

**Characteristics**:
- Fast (< 0.1s per test)
- Isolated (no external dependencies)
- Precise (test one thing)
- Mocked (all external calls mocked)

**Example**:
```typescript
import { describe, it, expect } from "vitest";
import { calculateLineItemTotals } from "@/lib/db/models/order";

describe("unit: calculateLineItemTotals", () => {
  it("should calculate line totals correctly", () => {
    /**
     * Test line totals calculation.
     * qty=10, unit_price=80, vat=22%
     * Expected: line_net=800, line_vat=176, line_total=976
     */
    // Arrange
    const quantity = 10;
    const list_price = 100;
    const unit_price = 80;
    const vat_rate = 22;

    // Act
    const result = calculateLineItemTotals(quantity, list_price, unit_price, vat_rate);

    // Assert
    expect(result.line_net).toBe(800);
    expect(result.line_vat).toBe(176);
    expect(result.line_total).toBe(976);
  });
});
```

**File location**: `src/test/unit/{module}.test.ts`

---

### 2. Integration Tests

**What to test**:
- Next.js API route handlers
- Service layer with MongoDB
- Multiple components working together
- Database operations
- Error handling across layers

**Characteristics**:
- Real dependencies (MongoDB in-memory)
- Full stack (API → Service → Repository → DB)
- Data persistence verified
- Automatic cleanup between tests

**Example**:
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";

// Mock session at module level
vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(() => Promise.resolve({
    isLoggedIn: true,
    userId: "test-customer-123",
  })),
}));

vi.mock("@/lib/db/connection", () => ({
  connectToDatabase: vi.fn(() => Promise.resolve()),
}));

import { POST as createOrder } from "@/app/api/b2b/orders/route";

describe("integration: Orders API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it("should create draft order with valid payload", async () => {
    /**
     * Test that a new draft order is created.
     * Verifies order_id generation and default status.
     */
    // Arrange
    const req = new NextRequest("http://localhost/api/b2b/orders", {
      method: "POST",
      body: JSON.stringify({ customer_id: "test-123" }),
      headers: { "Content-Type": "application/json" },
    });

    // Act
    const res = await createOrder(req);
    const data = await res.json();

    // Assert
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.order.status).toBe("draft");
  });
});
```

**File location**: `src/test/api/{module}.test.ts`

---

### 3. End-to-End (E2E) Tests

**What to test**:
- Complete user journeys
- Multi-step workflows
- Real-world scenarios
- Cross-module interactions

**Example** (Playwright):
```typescript
import { test, expect } from "@playwright/test";

test.describe("e2e: B2B Order Flow", () => {
  test("should complete checkout flow", async ({ page }) => {
    // 1. Login
    await page.goto("/b2b/login");
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');

    // 2. Add to cart
    await page.goto("/b2b/products");
    await page.click('[data-testid="add-to-cart"]');

    // 3. Checkout
    await page.goto("/b2b/cart");
    await page.click('[data-testid="checkout"]');

    // 4. Verify
    await expect(page.locator('[data-testid="order-confirmed"]')).toBeVisible();
  });
});
```

**File location**: `e2e/{flow}.spec.ts`

---

## Test Structure

### File Organization

```
src/test/
  setup.ts              # Vitest global setup
  conftest.ts           # Shared fixtures & factories
  unit/
    calculations.test.ts
    validation.test.ts
  api/
    orders.test.ts      # Integration tests
    products.test.ts
  components/
    Button.test.tsx     # React component tests

e2e/                    # Playwright E2E tests (optional)
  checkout.spec.ts
```

### Arrange-Act-Assert (AAA) Pattern

All tests should follow the AAA pattern:

```typescript
it("should do something", async () => {
  /**
   * Description of what is being tested.
   */
  // Arrange - Set up test data
  const order = OrderFactory.createPayload();

  // Act - Perform the action
  const result = await createOrder(order);

  // Assert - Verify the outcome
  expect(result.status).toBe("draft");
});
```

### Test Naming Convention

Use descriptive names:

**Good**:
```typescript
it("should create draft order with valid payload")
it("should return 400 when customer_id is missing")
it("should increment quantity for existing entity_code")
```

**Bad**:
```typescript
it("creates order")
it("test validation")
it("cart test")
```

---

## Mocking Strategy

### When to Mock

**Mock these**:
- External APIs (payment gateways, email services)
- Session/auth (`getB2BSession`)
- Database connection (`connectToDatabase`)
- Non-deterministic behavior (nanoid, Date.now)

**Don't mock** (in integration tests):
- Database operations (use mongodb-memory-server)
- Business logic
- Data validation

### How to Mock

**1. Module-level mocking** (must be before imports):
```typescript
import { vi } from "vitest";

vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(() => Promise.resolve({
    isLoggedIn: true,
    userId: "test-123",
  })),
}));

// Import after mock
import { handler } from "@/app/api/route";
```

**2. Per-test mocking**:
```typescript
import { vi } from "vitest";
import * as session from "@/lib/auth/b2b-session";

it("should return 401 when not logged in", async () => {
  vi.spyOn(session, "getB2BSession").mockResolvedValueOnce({
    isLoggedIn: false,
    userId: null,
  });

  const res = await handler(req);
  expect(res.status).toBe(401);
});
```

---

## Test Fixtures

### Shared Fixtures (`conftest.ts`)

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { nanoid } from "nanoid";

let mongoServer: MongoMemoryServer | null = null;

export async function setupTestDatabase(): Promise<string> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return uri;
}

export async function teardownTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
```

### Factories

```typescript
export const OrderFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    return {
      customer_id: `test-customer-${nanoid(8)}`,
      price_list_id: "default",
      currency: "EUR",
      ...overrides,
    };
  },
};

export const LineItemFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    const entityCode = `PROD-${nanoid(6)}`;
    return {
      entity_code: entityCode,
      sku: entityCode,
      quantity: 10,
      list_price: 100,
      unit_price: 80,
      vat_rate: 22,
      name: `Test Product ${entityCode}`,
      ...overrides,
    };
  },
};
```

### Request Helpers

```typescript
import { NextRequest } from "next/server";

export function createRequest(
  method: string,
  body?: unknown,
  url = "http://localhost:3000/api"
): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

// Next.js 15 params helper
export function createParams<T extends Record<string, string>>(
  params: T
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}
```

---

## Running Tests

### Commands

```bash
# Run all tests
pnpm test

# Run specific file
pnpm test orders

# Watch mode
pnpm test --watch

# Run with UI
pnpm test --ui

# Coverage
pnpm test --coverage
```

### Vitest Configuration

**`vitest.config.ts`**:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    testTimeout: 30000, // MongoDB can be slow to start
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

---

## Code Coverage

### Targets

| Component | Target |
|-----------|--------|
| API routes | 85-95% |
| Services/lib | 90-95% |
| Components | 70-80% |
| Utilities | 75-85% |
| **Overall** | **80-90%** |

### What Not to Cover

- Auto-generated code
- Type-only files
- Configuration files
- Debug/logging code

---

## CI/CD Pipeline

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm test
      - run: pnpm test --coverage
```

---

## Best Practices

### DO

1. Write tests first (TDD approach)
2. Test behavior, not implementation
3. Use descriptive test names
4. Keep tests simple and focused
5. Clean up test data between tests
6. Use factories for test data
7. Mock external dependencies
8. Test error cases
9. Verify edge cases

### DON'T

1. Don't test implementation details
2. Don't have tests depend on each other
3. Don't use hardcoded IDs (use nanoid)
4. Don't skip error cases
5. Don't mock internal business logic
6. Don't write brittle tests
7. Don't ignore failing tests
8. Don't aim for 100% coverage blindly

---

## Troubleshooting

### MongoDB Connection Errors

```typescript
// Increase timeout in vitest.config.ts
testTimeout: 30000,
```

### Tests Failing Randomly

- Use unique test data (nanoid)
- Clear database in beforeEach()
- Check for race conditions

### Import Errors

Ensure mocks are defined before imports:

```typescript
// WRONG
import { handler } from "./route";
vi.mock("@/lib/auth");

// CORRECT
vi.mock("@/lib/auth");
import { handler } from "./route";
```

---

## Quick Reference

```bash
# All tests
pnpm test

# Specific file
pnpm test orders

# Watch mode
pnpm test --watch

# With coverage
pnpm test --coverage

# Specific test by name
pnpm test -t "should create draft order"
```

---

## Critical Infrastructure Tests

### Tenant Provisioning (CRUCIAL)

Tenant creation/deletion is a **critical path** that must never break. These tests verify multi-tenant infrastructure.

#### Test Scripts

| Script                                     | Purpose                      | When to Run                      |
| ------------------------------------------ | ---------------------------- | -------------------------------- |
| `node scripts/test-tenant-lifecycle.cjs`   | Direct service function test | After changes to tenant services |
| `node scripts/test-tenant-api.cjs`         | Full API test with auth      | Before releases                  |
| `node scripts/check-tenant.cjs <id>`       | Verify tenant state          | Debugging/auditing               |

#### What Gets Tested

**Creation (`createTenant()`):**

| Step | Resource               | Expected                                 |
| ---- | ---------------------- | ---------------------------------------- |
| 1    | Solr collection        | `vinc-{tenant-id}` created               |
| 2    | MongoDB database       | `vinc-{tenant-id}` created               |
| 3    | Admin user             | 1 user in `b2busers`                     |
| 4    | Languages              | 43 seeded, 1 enabled (Italian)           |
| 5    | Notification templates | 15 seeded (13 default + 2 campaign)      |
| 6    | Admin registry         | Entry in `vinc-admin.tenants`            |

**Deletion (`deleteTenant()`):**

| Step | Action                         | Verified                   |
| ---- | ------------------------------ | -------------------------- |
| 1    | Delete Solr collection/core    | Collection removed         |
| 2    | Drop MongoDB database          | Database removed           |
| 3    | Remove from connection pool    | Stale connections cleared  |
| 4    | Remove from admin registry     | Tenant record deleted      |

#### Files That Require These Tests

Changes to these files **MUST** be followed by tenant tests:

```text
src/lib/services/admin-tenant.service.ts    # Core provisioning logic
src/lib/db/connection-pool.ts               # Connection management
src/lib/notifications/seed-templates.ts     # Template seeding
src/app/api/admin/tenants/route.ts          # Create API
src/app/api/admin/tenants/[id]/route.ts     # Delete API
```

#### Running Tenant Tests

```bash
# Quick test (direct service calls, ~10 seconds)
node scripts/test-tenant-lifecycle.cjs

# Full API test (creates temp super admin, ~20 seconds)
node scripts/test-tenant-api.cjs

# Check existing tenant
node scripts/check-tenant.cjs hidros-it
```

#### Expected Output

```text
============================================================
TEST SUMMARY
============================================================

Creation via API:  ✅ PASSED
Deletion via API:  ✅ PASSED

Overall Result: ✅ ALL TESTS PASSED
```

#### Debugging Tenant Issues

```bash
# 1. Check tenant state
node scripts/check-tenant.cjs <tenant-id>

# 2. Check Solr collections
curl "http://149.81.163.109:8983/solr/admin/collections?action=LIST" | jq .collections

# 3. Check MongoDB databases
mongosh "$VINC_MONGO_URL" --eval "db.adminCommand('listDatabases').databases.filter(d => d.name.startsWith('vinc-'))"

# 4. Check admin registry
mongosh "$VINC_MONGO_URL/vinc-admin" --eval "db.tenants.find({}).pretty()"
```

#### Failure Recovery

If tenant creation fails mid-way, clean up manually:

```bash
# Delete orphaned Solr collection
curl "http://149.81.163.109:8983/solr/admin/collections?action=DELETE&name=vinc-{tenant-id}"

# Delete orphaned MongoDB database
mongosh "$VINC_MONGO_URL/vinc-{tenant-id}" --eval "db.dropDatabase()"

# Delete orphaned admin record
mongosh "$VINC_MONGO_URL/vinc-admin" --eval "db.tenants.deleteOne({tenant_id: '{tenant-id}'})"
```

---

## Pre-Release Checklist

Before any release, run these tests in order:

```bash
# 1. Unit tests (fast, no external deps)
npm test

# 2. Tenant provisioning tests (CRITICAL)
node scripts/test-tenant-api.cjs

# 3. Verify existing tenant health
node scripts/check-tenant.cjs hidros-it
```

All must pass before deployment.

---

**Last Updated**: January 2026
**Version**: 2.1 (Next.js + Tenant Provisioning)
**Status**: Active Standard
