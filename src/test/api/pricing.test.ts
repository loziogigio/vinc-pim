import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";

// ============================================
// MOCKS — must be at module level BEFORE imports
// ============================================

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
      userId: "test-user",
    })
  ),
}));

vi.mock("@/lib/db/connection", async () => {
  const { TenantPricingConfigModel } = await import(
    "@/lib/db/models/tenant-pricing-config"
  );
  return {
    connectWithModels: vi.fn(() =>
      Promise.resolve({
        TenantPricingConfig: TenantPricingConfigModel,
      })
    ),
  };
});

// Mock the pricing service for API route tests
const mockResolvePrices = vi.fn();
vi.mock("@/lib/pricing/pricing.service", () => ({
  resolvePrices: (...args: any[]) => mockResolvePrices(...args),
  invalidatePricingConfigCache: vi.fn(),
}));

// Mock circuit breaker state
vi.mock("@/lib/pricing/circuit-breaker", () => ({
  getCircuitState: vi.fn(() => ({
    tenant_id: "test-tenant",
    status: "closed",
    failure_count: 0,
    success_count: 0,
    last_failure_at: 0,
    opened_at: 0,
  })),
}));

// Mock provider registry
vi.mock("@/lib/pricing/providers/register-providers", () => ({
  initializePricingProviders: vi.fn(),
}));

vi.mock("@/lib/pricing/providers/provider-registry", () => ({
  getPricingProvider: vi.fn(() => ({
    name: "legacy_erp",
    testConnection: vi.fn(() =>
      Promise.resolve({ success: true, message: "Connected", latency_ms: 42 })
    ),
  })),
}));

// Import AFTER mocks
import { POST as postPrices } from "@/app/api/b2b/pricing/prices/route";
import {
  GET as getConfig,
  PUT as putConfig,
} from "@/app/api/b2b/pricing/config/route";
import { POST as postTest } from "@/app/api/b2b/pricing/test/route";
import { TenantPricingConfigModel } from "@/lib/db/models/tenant-pricing-config";

describe("integration: Pricing API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  // ============================================
  // POST /api/b2b/pricing/prices
  // ============================================

  describe("POST /api/b2b/pricing/prices", () => {
    it("should return prices for valid entity_codes", async () => {
      /**
       * Test successful pricing request with mocked service.
       */
      // Arrange
      mockResolvePrices.mockResolvedValue({
        status: "success",
        data: {
          PROD001: {
            entity_code: "PROD001",
            net_price: 10.0,
            gross_price: 12.2,
            price: 10.0,
            price_discount: 10.0,
            vat_percent: 22,
            availability: 100,
            discount: [],
            discount_description: "",
          },
        },
      });

      const req = new NextRequest("http://localhost/api/b2b/pricing/prices", {
        method: "POST",
        body: JSON.stringify({
          entity_codes: ["PROD001"],
          quantity_list: [1],
          customer_code: "CUST001",
          address_code: "ADDR001",
          id_cart: "CART001",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await postPrices(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data.PROD001).toBeDefined();
      expect(data.data.PROD001.net_price).toBe(10.0);
      expect(data.data.PROD001.gross_price).toBe(12.2);
    });

    it("should return 400 when entity_codes is missing", async () => {
      /**
       * Test validation: entity_codes is required.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/pricing/prices", {
        method: "POST",
        body: JSON.stringify({ customer_code: "CUST001" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await postPrices(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("entity_codes");
    });

    it("should return 400 when entity_codes is empty", async () => {
      /**
       * Test validation: entity_codes must be non-empty.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/pricing/prices", {
        method: "POST",
        body: JSON.stringify({
          entity_codes: [],
          customer_code: "CUST001",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await postPrices(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("entity_codes");
    });

    it("should default quantity_list when not provided", async () => {
      /**
       * Test that quantity_list defaults to array of 1s.
       */
      // Arrange
      mockResolvePrices.mockResolvedValue({ status: "success", data: {} });

      const req = new NextRequest("http://localhost/api/b2b/pricing/prices", {
        method: "POST",
        body: JSON.stringify({
          entity_codes: ["PROD001", "PROD002"],
          customer_code: "CUST001",
          address_code: "ADDR001",
          id_cart: "CART001",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      await postPrices(req);

      // Assert — verify resolvePrices was called with defaulted quantity_list
      expect(mockResolvePrices).toHaveBeenCalledWith(
        "vinc-test-tenant",
        "test-tenant",
        expect.objectContaining({
          entity_codes: ["PROD001", "PROD002"],
          quantity_list: [1, 1],
        })
      );
    });

    it("should include errors when provider has issues", async () => {
      /**
       * Test error pass-through from pricing service.
       */
      // Arrange
      mockResolvePrices.mockResolvedValue({
        status: "success",
        data: {},
        errors: { provider_error: "Connection timed out" },
      });

      const req = new NextRequest("http://localhost/api/b2b/pricing/prices", {
        method: "POST",
        body: JSON.stringify({
          entity_codes: ["PROD001"],
          customer_code: "CUST001",
          id_cart: "CART001",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await postPrices(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.status).toBe("success");
      expect(data.errors?.provider_error).toBe("Connection timed out");
    });
  });

  // ============================================
  // GET/PUT /api/b2b/pricing/config
  // ============================================

  describe("GET /api/b2b/pricing/config", () => {
    it("should return null when no config exists", async () => {
      /**
       * Test graceful handling of missing config.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/pricing/config", {
        method: "GET",
      });

      // Act
      const res = await getConfig(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeNull();
    });

    it("should return existing config", async () => {
      /**
       * Test reading back a saved config.
       */
      // Arrange — create config directly
      await TenantPricingConfigModel.create({
        tenant_id: "test-tenant",
        active_provider: "legacy_erp",
        providers: {
          legacy_erp: {
            api_base_url: "http://erp.test:8000/api/v1",
            auth_method: "none",
            timeout_ms: 5000,
            enabled: true,
          },
        },
        cache: { enabled: false, ttl_seconds: 60 },
        fallback: { log_errors: true, max_retries: 1 },
        circuit_breaker: {
          failure_threshold: 3,
          recovery_timeout_ms: 30000,
          success_threshold: 1,
        },
      });

      const req = new NextRequest("http://localhost/api/b2b/pricing/config", {
        method: "GET",
      });

      // Act
      const res = await getConfig(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tenant_id).toBe("test-tenant");
      expect(data.data.active_provider).toBe("legacy_erp");
      expect(data.data.providers.legacy_erp.api_base_url).toBe(
        "http://erp.test:8000/api/v1"
      );
    });
  });

  describe("PUT /api/b2b/pricing/config", () => {
    it("should create config when none exists (upsert)", async () => {
      /**
       * Test upsert behavior — creates new config.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/pricing/config", {
        method: "PUT",
        body: JSON.stringify({
          active_provider: "legacy_erp",
          providers: {
            legacy_erp: {
              api_base_url: "http://erp.test:8000/api/v1",
              auth_method: "bearer",
              bearer_token: "test-token",
              timeout_ms: 3000,
              enabled: true,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await putConfig(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.active_provider).toBe("legacy_erp");
      expect(data.data.providers.legacy_erp.enabled).toBe(true);
    });

    it("should update existing config", async () => {
      /**
       * Test updating an existing config changes the values.
       */
      // Arrange — create initial config
      await TenantPricingConfigModel.create({
        tenant_id: "test-tenant",
        active_provider: "legacy_erp",
        providers: {
          legacy_erp: {
            api_base_url: "http://old-erp.test:8000",
            auth_method: "none",
            timeout_ms: 5000,
            enabled: true,
          },
        },
        cache: { enabled: false, ttl_seconds: 60 },
        fallback: { log_errors: true, max_retries: 1 },
        circuit_breaker: {
          failure_threshold: 3,
          recovery_timeout_ms: 30000,
          success_threshold: 1,
        },
      });

      const req = new NextRequest("http://localhost/api/b2b/pricing/config", {
        method: "PUT",
        body: JSON.stringify({
          active_provider: "generic_http",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await putConfig(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.data.active_provider).toBe("generic_http");
    });
  });

  // ============================================
  // POST /api/b2b/pricing/test
  // ============================================

  describe("POST /api/b2b/pricing/test", () => {
    it("should test provider connection", async () => {
      /**
       * Test connection health check endpoint.
       */
      // Arrange — create config
      await TenantPricingConfigModel.create({
        tenant_id: "test-tenant",
        active_provider: "legacy_erp",
        providers: {
          legacy_erp: {
            api_base_url: "http://erp.test:8000/api/v1",
            auth_method: "none",
            timeout_ms: 5000,
            enabled: true,
          },
        },
        cache: { enabled: false, ttl_seconds: 60 },
        fallback: { log_errors: true, max_retries: 1 },
        circuit_breaker: {
          failure_threshold: 3,
          recovery_timeout_ms: 30000,
          success_threshold: 1,
        },
      });

      const req = new NextRequest("http://localhost/api/b2b/pricing/test", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await postTest(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.provider).toBe("legacy_erp");
      expect(data.data.success).toBe(true);
      expect(data.data.latency_ms).toBeDefined();
      expect(data.data.circuit_breaker).toBeDefined();
      expect(data.data.circuit_breaker.status).toBe("closed");
    });

    it("should return 400 when no provider is configured", async () => {
      /**
       * Test error when tenant has no pricing config.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/pricing/test", {
        method: "POST",
        body: JSON.stringify({ provider: "legacy_erp" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await postTest(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });
});
