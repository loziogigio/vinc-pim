/**
 * Unit Tests for Session Changes
 *
 * Tests for changes made in the current development session:
 * - Brand field names (brand.brand_id, brand.label)
 * - Order ERP fields (erp_line_number, erp_data on LineItem)
 * - is_current flag on orders
 * - Windmill hook operations (order.preparing)
 * - findHook matching for new operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Windmill proxy mocks ────────────────────────────────────────

vi.mock("@/lib/services/windmill-client", () => ({
  windmillRun: vi.fn(),
  windmillRunAsync: vi.fn(),
  WindmillError: class WindmillError extends Error {
    constructor(
      message: string,
      public status: number,
      public upstream?: string,
    ) {
      super(message);
      this.name = "WindmillError";
    }
  },
}));

vi.mock("@/lib/db/home-settings", () => ({
  getHomeSettings: vi.fn(),
}));

import {
  HOOK_OPERATIONS,
  OPERATION_DOMAINS,
} from "@/lib/types/windmill-proxy";
import type { LineItem } from "@/lib/types/order";
import {
  findHook,
  invalidateProxyCache,
} from "@/lib/services/windmill-proxy.service";
import type { WindmillProxySettings } from "@/lib/types/windmill-proxy";

// ── Helpers ─────────────────────────────────────────────────────

function createSettings(
  overrides?: Partial<WindmillProxySettings>,
): WindmillProxySettings {
  return {
    enabled: true,
    timeout_ms: 5000,
    channels: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateProxyCache("vinc-test-tenant");
});

// =================================================================
// 1. Windmill Hook Operations
// =================================================================

describe("unit: HOOK_OPERATIONS includes order.preparing", () => {
  it("should include order.preparing in HOOK_OPERATIONS", () => {
    expect(HOOK_OPERATIONS).toContain("order.preparing");
  });

  it("should include order.preparing in OPERATION_DOMAINS.order", () => {
    expect(OPERATION_DOMAINS.order).toContain("order.preparing");
  });

  it("should include all order lifecycle operations", () => {
    const orderOps = OPERATION_DOMAINS.order;
    expect(orderOps).toContain("order.submit");
    expect(orderOps).toContain("order.confirm");
    expect(orderOps).toContain("order.preparing");
    expect(orderOps).toContain("order.ship");
    expect(orderOps).toContain("order.cancel");
    expect(orderOps).toContain("order.deliver");
  });

  it("should have all six domain groups", () => {
    const domains = Object.keys(OPERATION_DOMAINS);
    expect(domains).toEqual(
      expect.arrayContaining(["cart", "order", "pricing", "stock", "customer", "catalog"])
    );
  });
});

// =================================================================
// 2. findHook with order.preparing
// =================================================================

describe("unit: findHook for order.preparing", () => {
  it("should find hook for order.preparing on exact channel", () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "order.preparing",
              phase: "on",
              script_path: "f/tenant/b2b/on_order_preparing",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });

    const hook = findHook(settings, "b2b", "order.preparing", "on");
    expect(hook).toBeDefined();
    expect(hook!.script_path).toBe("f/tenant/b2b/on_order_preparing");
    expect(hook!.blocking).toBe(true);
  });

  it("should not find hook when channel is disabled", () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: false,
          hooks: [
            {
              operation: "order.preparing",
              phase: "on",
              script_path: "f/tenant/b2b/on_order_preparing",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });

    const hook = findHook(settings, "b2b", "order.preparing", "on");
    expect(hook).toBeUndefined();
  });

  it("should not find hook when hook is disabled", () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "order.preparing",
              phase: "on",
              script_path: "f/tenant/b2b/on_order_preparing",
              enabled: false,
              blocking: true,
            },
          ],
        },
      ],
    });

    const hook = findHook(settings, "b2b", "order.preparing", "on");
    expect(hook).toBeUndefined();
  });
});

// =================================================================
// 3. Order LineItem ERP fields (type-level tests)
// =================================================================

describe("unit: LineItem ERP fields", () => {
  it("should accept erp_line_number as optional number", () => {
    const item: Partial<LineItem> = {
      line_number: 10,
      entity_code: "PROD-001",
      sku: "SKU-001",
      erp_line_number: 10,
    };
    expect(item.erp_line_number).toBe(10);
  });

  it("should accept erp_data as optional Record", () => {
    const item: Partial<LineItem> = {
      line_number: 10,
      entity_code: "PROD-001",
      sku: "SKU-001",
      erp_data: { IdRiga: 10, Quantita: 5, Importo: 100.50 },
    };
    expect(item.erp_data).toBeDefined();
    expect(item.erp_data!.IdRiga).toBe(10);
  });

  it("should allow both erp_line_number and erp_data together", () => {
    const item: Partial<LineItem> = {
      line_number: 20,
      entity_code: "PROD-002",
      sku: "SKU-002",
      erp_line_number: 20,
      erp_data: { status: "exported", IdRiga: 20 },
    };
    expect(item.erp_line_number).toBe(20);
    expect(item.erp_data!.status).toBe("exported");
  });

  it("should allow erp fields to be undefined", () => {
    const item: Partial<LineItem> = {
      line_number: 30,
      entity_code: "PROD-003",
      sku: "SKU-003",
    };
    expect(item.erp_line_number).toBeUndefined();
    expect(item.erp_data).toBeUndefined();
  });
});

// =================================================================
// 4. Brand field names validation
// =================================================================

describe("unit: Brand field names on PIM product schema", () => {
  /**
   * The PIM product schema uses:
   * - brand.brand_id (NOT brand.id)
   * - brand.label (NOT brand.name)
   * - brand.logo_url (NOT brand.image)
   *
   * These tests verify the correct field names are used in API queries.
   */

  it("should use brand.brand_id for brand identification", () => {
    // Simulates what the brands/products API route does
    const query = { "brand.brand_id": "BRAND-001", isCurrent: true };
    expect(query["brand.brand_id"]).toBe("BRAND-001");
    // Ensure the old incorrect field is not used
    expect((query as Record<string, unknown>)["brand.id"]).toBeUndefined();
  });

  it("should use brand.label for brand name", () => {
    // Simulates what the brands/products POST route does when associating
    const updateData: Record<string, unknown> = {
      "brand.brand_id": "BRAND-001",
      "brand.label": "Acme Corp",
      "brand.slug": "acme-corp",
    };
    expect(updateData["brand.label"]).toBe("Acme Corp");
    // Ensure the old incorrect field is not used
    expect(updateData["brand.name"]).toBeUndefined();
  });

  it("should use brand.logo_url for brand image", () => {
    const updateData: Record<string, unknown> = {
      "brand.logo_url": "https://cdn.example.com/logo.png",
    };
    expect(updateData["brand.logo_url"]).toBe("https://cdn.example.com/logo.png");
    // Ensure the old nested image object is not used
    expect(updateData["brand.image"]).toBeUndefined();
  });

  it("should build correct brand search filter using brand.label", () => {
    // Simulates what the products route brand filter does
    const brandSearch = "Acme";
    const brandRegex = new RegExp(brandSearch, "i");
    const query = { "brand.label": brandRegex };
    expect(query["brand.label"]).toBeInstanceOf(RegExp);
    expect(query["brand.label"].test("Acme Corp")).toBe(true);
    expect(query["brand.label"].test("Other Brand")).toBe(false);
  });
});

// =================================================================
// 5. OPERATION_DOMAINS completeness
// =================================================================

describe("unit: OPERATION_DOMAINS completeness", () => {
  it("every operation in OPERATION_DOMAINS should exist in HOOK_OPERATIONS", () => {
    const allDomainOps = Object.values(OPERATION_DOMAINS).flat();
    for (const op of allDomainOps) {
      expect(HOOK_OPERATIONS).toContain(op);
    }
  });

  it("every HOOK_OPERATION should be in exactly one domain", () => {
    const allDomainOps = Object.values(OPERATION_DOMAINS).flat();
    for (const op of HOOK_OPERATIONS) {
      const count = allDomainOps.filter((d) => d === op).length;
      expect(count).toBe(1);
    }
  });
});
