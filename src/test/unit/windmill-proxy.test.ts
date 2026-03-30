/**
 * Windmill Proxy Service Tests
 *
 * Unit tests for the three-phase hook middleware.
 * Mocks windmill-client and getHomeSettings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module-level mocks (must be before imports) ──────────────────

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
  getProxySettings,
  invalidateProxyCache,
  findHook,
  runBeforeHook,
  runOnHook,
  runAfterHook,
  mergeOrderErpData,
} from "@/lib/services/windmill-proxy.service";
import { windmillRun, windmillRunAsync, WindmillError } from "@/lib/services/windmill-client";
import { getHomeSettings } from "@/lib/db/home-settings";
import type {
  WindmillProxySettings,
  HookContext,
} from "@/lib/types/windmill-proxy";

// ── Factories ────────────────────────────────────────────────────

function createSettings(
  overrides?: Partial<WindmillProxySettings>,
): WindmillProxySettings {
  return {
    enabled: true,
    timeout_ms: 5000,
    workspace_name: "vinc-test-tenant",
    channels: [],
    ...overrides,
  };
}

function createCtx(overrides?: Partial<HookContext>): HookContext {
  return {
    tenantDb: "vinc-test-tenant",
    tenantId: "test-tenant",
    channel: "b2b",
    operation: "item.add",
    orderId: "ORD-001",
    customerCode: "CUST-001",
    ...overrides,
  };
}

const mockGetHomeSettings = getHomeSettings as ReturnType<typeof vi.fn>;
const mockWindmillRun = windmillRun as ReturnType<typeof vi.fn>;
const mockWindmillRunAsync = windmillRunAsync as ReturnType<typeof vi.fn>;

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Clear internal settings cache between tests
  invalidateProxyCache("vinc-test-tenant");
});

// ─── findHook ────────────────────────────────────────────────────

describe("unit: findHook", () => {
  it("should find hook for exact channel match", () => {
    // Arrange
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/check_stock",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });

    // Act
    const hook = findHook(settings, "b2b", "item.add", "before");

    // Assert
    expect(hook).toBeDefined();
    expect(hook!.script_path).toBe("f/erp/check_stock");
  });

  it("should fall back to wildcard channel when no exact match", () => {
    // Arrange
    const settings = createSettings({
      channels: [
        {
          channel: "*",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "on",
              script_path: "f/erp/sync_item",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });

    // Act
    const hook = findHook(settings, "b2c", "item.add", "on");

    // Assert
    expect(hook).toBeDefined();
    expect(hook!.script_path).toBe("f/erp/sync_item");
  });

  it("should prefer exact channel over wildcard", () => {
    // Arrange
    const settings = createSettings({
      channels: [
        {
          channel: "*",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/wildcard",
              enabled: true,
              blocking: false,
            },
          ],
        },
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/b2b_specific",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });

    // Act
    const hook = findHook(settings, "b2b", "item.add", "before");

    // Assert
    expect(hook!.script_path).toBe("f/erp/b2b_specific");
  });

  it("should return undefined when no matching hook", () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/script",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });

    const hook = findHook(settings, "b2b", "cart.create", "before");

    expect(hook).toBeUndefined();
  });

  it("should skip disabled channels", () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: false,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/disabled",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });

    const hook = findHook(settings, "b2b", "item.add", "before");

    expect(hook).toBeUndefined();
  });

  it("should skip disabled hooks", () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/disabled_hook",
              enabled: false,
              blocking: false,
            },
          ],
        },
      ],
    });

    const hook = findHook(settings, "b2b", "item.add", "before");

    expect(hook).toBeUndefined();
  });
});

// ─── getProxySettings ────────────────────────────────────────────

describe("unit: getProxySettings", () => {
  it("should return settings when enabled", async () => {
    // Arrange
    const settings = createSettings({ enabled: true });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });

    // Act
    const result = await getProxySettings("vinc-test-tenant");

    // Assert
    expect(result).toBeDefined();
    expect(result!.enabled).toBe(true);
  });

  it("should return null when windmill_proxy is disabled", async () => {
    mockGetHomeSettings.mockResolvedValue({
      windmill_proxy: { enabled: false, timeout_ms: 5000, channels: [] },
    });

    const result = await getProxySettings("vinc-test-tenant");

    expect(result).toBeNull();
  });

  it("should return null when windmill_proxy is not configured", async () => {
    mockGetHomeSettings.mockResolvedValue({});

    const result = await getProxySettings("vinc-test-tenant");

    expect(result).toBeNull();
  });

  it("should cache settings and not re-fetch within TTL", async () => {
    const settings = createSettings();
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });

    // First call — fetches
    await getProxySettings("vinc-test-tenant");
    // Second call — uses cache
    await getProxySettings("vinc-test-tenant");

    expect(mockGetHomeSettings).toHaveBeenCalledTimes(1);
  });

  it("should re-fetch after cache invalidation", async () => {
    const settings = createSettings();
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });

    await getProxySettings("vinc-test-tenant");
    invalidateProxyCache("vinc-test-tenant");
    await getProxySettings("vinc-test-tenant");

    expect(mockGetHomeSettings).toHaveBeenCalledTimes(2);
  });
});

// ─── runBeforeHook ───────────────────────────────────────────────

describe("unit: runBeforeHook", () => {
  it("should return { hooked: false, allowed: true } when no settings", async () => {
    // Arrange
    mockGetHomeSettings.mockResolvedValue({});

    // Act
    const result = await runBeforeHook(createCtx());

    // Assert
    expect(result).toEqual({ hooked: false, allowed: true });
    expect(mockWindmillRun).not.toHaveBeenCalled();
  });

  it("should return { hooked: false, allowed: true } when no matching hook", async () => {
    mockGetHomeSettings.mockResolvedValue({
      windmill_proxy: createSettings({ channels: [] }),
    });

    const result = await runBeforeHook(createCtx());

    expect(result.hooked).toBe(false);
    expect(result.allowed).toBe(true);
  });

  it("should call Windmill and return allowed=true on approval", async () => {
    // Arrange
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/check_stock",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockResolvedValue({ allowed: true, message: "Stock OK" });

    // Act
    const result = await runBeforeHook(createCtx());

    // Assert
    expect(result.hooked).toBe(true);
    expect(result.allowed).toBe(true);
    expect(mockWindmillRun).toHaveBeenCalledOnce();

    // Verify payload structure
    const [ws, scriptPath, payload] = mockWindmillRun.mock.calls[0];
    expect(ws).toBe("vinc-test-tenant");
    expect(scriptPath).toBe("f/erp/check_stock");
    expect(payload.operation).toBe("item.add");
    expect(payload.phase).toBe("before");
    expect(payload.tenant_id).toBe("test-tenant");
    expect(payload.channel).toBe("b2b");
  });

  it("should return allowed=false when hook rejects", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/check_stock",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockResolvedValue({
      allowed: false,
      message: "Out of stock",
    });

    const result = await runBeforeHook(createCtx());

    expect(result.hooked).toBe(true);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe("Out of stock");
  });

  it("should return modified_data when hook provides it", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/price_check",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockResolvedValue({
      allowed: true,
      modified_data: { unit_price: 42.50 },
    });

    const result = await runBeforeHook(createCtx());

    expect(result.modified_data).toEqual({ unit_price: 42.50 });
  });

  it("should block on timeout when hook is blocking", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/slow",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockRejectedValue(new WindmillError("Windmill timeout", 504));

    const result = await runBeforeHook(createCtx());

    expect(result.hooked).toBe(true);
    expect(result.allowed).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.message).toBe("ERP validation timed out");
  });

  it("should allow on timeout when hook is non-blocking", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/slow",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockRejectedValue(new WindmillError("Windmill timeout", 504));

    const result = await runBeforeHook(createCtx());

    expect(result.hooked).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.timedOut).toBe(true);
  });

  it("should block on generic error when hook is blocking", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/broken",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockRejectedValue(new WindmillError("Windmill 500", 500));

    const result = await runBeforeHook(createCtx());

    expect(result.allowed).toBe(false);
    expect(result.timedOut).toBeFalsy();
    expect(result.message).toBe("ERP validation failed");
  });

  it("should use per-hook timeout_ms override", async () => {
    const settings = createSettings({
      timeout_ms: 5000,
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "before",
              script_path: "f/erp/fast",
              enabled: true,
              blocking: false,
              timeout_ms: 2000,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockResolvedValue({ allowed: true });

    await runBeforeHook(createCtx());

    // 4th argument is timeout
    expect(mockWindmillRun.mock.calls[0][3]).toBe(2000);
  });
});

// ─── runOnHook ───────────────────────────────────────────────────

describe("unit: runOnHook", () => {
  it("should return { hooked: false, success: true } when no settings", async () => {
    mockGetHomeSettings.mockResolvedValue({});

    const result = await runOnHook(createCtx());

    expect(result).toEqual({ hooked: false, success: true, blocking: false });
  });

  it("should call Windmill and return success with response data", async () => {
    // Arrange
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "on",
              script_path: "f/erp/sync_item",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    const erpResponse = {
      success: true,
      data: { erp_data: { erp_price: 12.5 } },
      message: "Synced",
    };
    mockWindmillRun.mockResolvedValue(erpResponse);

    // Act
    const result = await runOnHook(createCtx());

    // Assert
    expect(result.hooked).toBe(true);
    expect(result.success).toBe(true);
    expect(result.response).toEqual(erpResponse);
    expect(result.blocking).toBe(false);
  });

  it("should return blocking=true when hook config is blocking", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "order.confirm",
              phase: "on",
              script_path: "f/erp/confirm",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockResolvedValue({ success: true });

    const result = await runOnHook(
      createCtx({ operation: "order.confirm" }),
    );

    expect(result.blocking).toBe(true);
  });

  it("should return success=false and error on Windmill failure", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "on",
              script_path: "f/erp/sync_item",
              enabled: true,
              blocking: true,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockRejectedValue(
      new WindmillError("Windmill 500", 500),
    );

    const result = await runOnHook(createCtx());

    expect(result.hooked).toBe(true);
    expect(result.success).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.error).toContain("Windmill 500");
  });

  it("should set timedOut=true on 504 error", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "on",
              script_path: "f/erp/slow",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRun.mockRejectedValue(
      new WindmillError("Windmill timeout", 504),
    );

    const result = await runOnHook(createCtx());

    expect(result.timedOut).toBe(true);
    expect(result.error).toBe("ERP sync timed out");
  });
});

// ─── runAfterHook ────────────────────────────────────────────────

describe("unit: runAfterHook", () => {
  it("should not call windmill when no settings", async () => {
    mockGetHomeSettings.mockResolvedValue({});

    runAfterHook(createCtx());
    // Let microtasks flush
    await new Promise((r) => setTimeout(r, 50));

    expect(mockWindmillRunAsync).not.toHaveBeenCalled();
  });

  it("should call windmillRunAsync for matching after hook", async () => {
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "after",
              script_path: "f/erp/log_item",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRunAsync.mockResolvedValue("job-123");

    runAfterHook(createCtx());
    await new Promise((r) => setTimeout(r, 50));

    expect(mockWindmillRunAsync).toHaveBeenCalledOnce();
    const [ws, scriptPath, payload] = mockWindmillRunAsync.mock.calls[0];
    expect(ws).toBe("vinc-test-tenant");
    expect(scriptPath).toBe("f/erp/log_item");
    expect(payload.phase).toBe("after");
  });

  it("should not throw when windmillRunAsync fails", async () => {
    /**
     * After hooks are fire-and-forget. Errors should be logged,
     * never propagated to the caller.
     */
    const settings = createSettings({
      channels: [
        {
          channel: "b2b",
          enabled: true,
          hooks: [
            {
              operation: "item.add",
              phase: "after",
              script_path: "f/erp/broken",
              enabled: true,
              blocking: false,
            },
          ],
        },
      ],
    });
    mockGetHomeSettings.mockResolvedValue({ windmill_proxy: settings });
    mockWindmillRunAsync.mockRejectedValue(new Error("Network down"));

    // Should not throw
    expect(() => runAfterHook(createCtx())).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
  });
});

// ─── mergeOrderErpData ───────────────────────────────────────────

describe("unit: mergeOrderErpData", () => {
  it("should merge top-level erp_data and set sync status", async () => {
    // Arrange
    const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    const OrderModel = { updateOne: mockUpdateOne };

    const response = {
      success: true,
      data: {
        erp_data: { erp_order_number: "PB2B-2026-0042", warehouse: "W1" },
      },
    };

    // Act
    await mergeOrderErpData(OrderModel, "order-id-abc", response);

    // Assert
    expect(mockUpdateOne).toHaveBeenCalledOnce();
    const [filter, update] = mockUpdateOne.mock.calls[0];
    expect(filter).toEqual({ _id: "order-id-abc" });
    expect(update.$set["erp_data.erp_order_number"]).toBe("PB2B-2026-0042");
    expect(update.$set["erp_data.warehouse"]).toBe("W1");
    expect(update.$set.erp_sync_status).toBe("synced");
  });

  it("should merge per-item erp_data", async () => {
    const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    const OrderModel = { updateOne: mockUpdateOne };

    const response = {
      success: true,
      data: {
        erp_items: [
          { line_number: 10, erp_data: { erp_line_id: "L1" } },
          { line_number: 20, erp_data: { erp_line_id: "L2" } },
        ],
      },
    };

    await mergeOrderErpData(OrderModel, "order-id-abc", response);

    // 1 call for erp_sync_status + 2 calls for items
    expect(mockUpdateOne).toHaveBeenCalledTimes(3);

    // Item updates
    const [, updateItem1] = mockUpdateOne.mock.calls[1];
    expect(updateItem1.$set["items.$.erp_data"]).toEqual({ erp_line_id: "L1" });

    const [filterItem2] = mockUpdateOne.mock.calls[2];
    expect(filterItem2["items.line_number"]).toBe(20);
  });

  it("should do nothing when response has no data", async () => {
    const mockUpdateOne = vi.fn();
    const OrderModel = { updateOne: mockUpdateOne };

    await mergeOrderErpData(OrderModel, "order-id", { success: true });

    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});
