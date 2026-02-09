import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock ioredis to avoid import errors
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  })),
}));

// Mock the dependencies
vi.mock("@/lib/db/connection", async () => {
  const { OrderModel } = await import("@/lib/db/models/order");
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn().mockResolvedValue(undefined),
    connectWithModels: vi.fn(() => Promise.resolve({
      Order: OrderModel,
      Customer: CustomerModel,
    })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn().mockResolvedValue({
    isLoggedIn: true,
    userId: "test-user",
    tenantId: "test-tenant",
  }),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn((length: number) => "x".repeat(length || 12)),
}));

// Mock OrderModel
const mockOrderFindOne = vi.fn();
const mockOrderCreate = vi.fn();
const mockOrderCountDocuments = vi.fn();

vi.mock("@/lib/db/models/order", () => ({
  OrderModel: {
    findOne: (...args: unknown[]) => mockOrderFindOne(...args),
    create: (...args: unknown[]) => mockOrderCreate(...args),
    countDocuments: (...args: unknown[]) => mockOrderCountDocuments(...args),
  },
}));

// Mock counter for cart_number
vi.mock("@/lib/db/models/counter", () => ({
  getNextCartNumber: vi.fn().mockResolvedValue(1),
}));

// Mock customer service
const mockFindOrCreateCustomer = vi.fn();
const mockFindOrCreateAddress = vi.fn();

vi.mock("@/lib/services/customer.service", () => ({
  findOrCreateCustomer: (...args: unknown[]) => mockFindOrCreateCustomer(...args),
  findOrCreateAddress: (...args: unknown[]) => mockFindOrCreateAddress(...args),
}));

// Import the route handler after mocks are set up
import { POST } from "../active/route";

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: () => null, // No x-auth-method header, triggers session auth
    },
  } as unknown as NextRequest;
}

describe("POST /api/b2b/cart/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VINC_TENANT_ID = "test-tenant";
  });

  afterEach(() => {
    delete process.env.VINC_TENANT_ID;
  });

  describe("Validation", () => {
    it("should return 400 if customer_code is missing", async () => {
      const req = createMockRequest({ address_code: "ADDR-001" });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("customer_code is required");
    });

    it("should return 400 if address_code is missing", async () => {
      const req = createMockRequest({ customer_code: "CUST-001" });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("address_code is required");
    });
  });

  describe("Existing Cart Lookup", () => {
    it("should return existing current cart if found", async () => {
      const existingCart = {
        order_id: "existing-cart-123",
        customer_id: "cust-123",
        customer_code: "CUST-001",
        shipping_address_id: "addr-123",
        shipping_address_code: "ADDR-001",
        is_current: true,
        status: "draft",
      };

      mockOrderFindOne.mockResolvedValue(existingCart);

      const req = createMockRequest({
        customer_code: "CUST-001",
        address_code: "ADDR-001",
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.is_new).toBe(false);
      expect(data.cart_id).toBe("existing-cart-123");
      expect(data.order_id).toBe("existing-cart-123");

      // Verify the lookup query (includes tenant_id)
      expect(mockOrderFindOne).toHaveBeenCalledWith({
        tenant_id: "test-tenant",
        customer_code: "CUST-001",
        shipping_address_code: "ADDR-001",
        is_current: true,
      });
    });
  });

  describe("New Cart Creation", () => {
    it("should create new cart when no existing cart found", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockFindOrCreateCustomer.mockResolvedValue({
        customer: {
          customer_id: "cust-new-123",
          external_code: "CUST-001",
          addresses: [
            { address_id: "addr-new-123", external_code: "ADDR-001" },
          ],
        },
        isNew: false,
      });
      mockOrderCountDocuments.mockResolvedValue(0);

      const newCart = {
        order_id: "xxxxxxxxxxxx",
        customer_id: "cust-new-123",
        customer_code: "CUST-001",
        shipping_address_id: "addr-new-123",
        shipping_address_code: "ADDR-001",
        is_current: true,
        status: "draft",
      };
      mockOrderCreate.mockResolvedValue(newCart);

      const req = createMockRequest({
        customer_code: "CUST-001",
        address_code: "ADDR-001",
        pricelist_type: "VEND",
        pricelist_code: "02",
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.is_new).toBe(true);
      expect(data.cart_id).toBeDefined();

      // Verify the create call includes is_current: true
      expect(mockOrderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "draft",
          is_current: true,
          customer_code: "CUST-001",
          shipping_address_code: "ADDR-001",
          pricelist_type: "VEND",
          pricelist_code: "02",
        })
      );
    });

    it("should return error if customer not found and no details provided", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockFindOrCreateCustomer.mockRejectedValue(new Error("Customer not found"));

      const req = createMockRequest({
        customer_code: "UNKNOWN-CUST",
        address_code: "ADDR-001",
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Customer not found");
    });

    it("should return error if address not found and no details provided", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockFindOrCreateCustomer.mockResolvedValue({
        customer: {
          customer_id: "cust-123",
          external_code: "CUST-001",
          addresses: [], // No addresses
        },
        isNew: false,
      });
      mockOrderCountDocuments.mockResolvedValue(0);

      const req = createMockRequest({
        customer_code: "CUST-001",
        address_code: "UNKNOWN-ADDR",
        // No address details provided
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Address not found and no details provided");
    });
  });

  describe("Customer/Address Lookup-or-Create", () => {
    it("should create customer with provided details", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockFindOrCreateCustomer.mockResolvedValue({
        customer: {
          customer_id: "cust-new-123",
          external_code: "CUST-001",
          addresses: [
            { address_id: "addr-new-123", external_code: "ADDR-001" },
          ],
        },
        isNew: true,
      });
      mockOrderCountDocuments.mockResolvedValue(0);
      mockOrderCreate.mockResolvedValue({
        order_id: "new-cart-123",
        is_current: true,
      });

      const req = createMockRequest({
        customer_code: "CUST-001",
        address_code: "ADDR-001",
        customer: {
          email: "test@example.com",
          company_name: "Test Company",
          customer_type: "business",
        },
      });

      await POST(req);

      // Verify customer lookup was called with provided details
      expect(mockFindOrCreateCustomer).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({
          customer_code: "CUST-001",
          customer: expect.objectContaining({
            email: "test@example.com",
            company_name: "Test Company",
            external_code: "CUST-001",
          }),
        })
      );
    });

    it("should create address with provided details when not found", async () => {
      const mockCustomer = {
        customer_id: "cust-123",
        external_code: "CUST-001",
        addresses: [], // No matching address
        save: vi.fn(),
      };
      mockOrderFindOne.mockResolvedValue(null);
      mockFindOrCreateCustomer.mockResolvedValue({
        customer: mockCustomer,
        isNew: false,
      });
      mockOrderCountDocuments.mockResolvedValue(0);
      mockFindOrCreateAddress.mockResolvedValue({
        address_id: "addr-new-123",
        external_code: "ADDR-001",
      });
      mockOrderCreate.mockResolvedValue({
        order_id: "new-cart-123",
        is_current: true,
      });

      const req = createMockRequest({
        customer_code: "CUST-001",
        address_code: "ADDR-001",
        address: {
          recipient_name: "Test Recipient",
          street_address: "Via Test 123",
          city: "Milano",
          province: "MI",
          postal_code: "20100",
          country: "IT",
        },
      });

      await POST(req);

      // Verify address creation was called with customer and address details
      expect(mockFindOrCreateAddress).toHaveBeenCalledWith(
        mockCustomer,
        expect.objectContaining({
          address: expect.objectContaining({
            recipient_name: "Test Recipient",
            external_code: "ADDR-001",
          }),
        }),
        "test-tenant",
      );
    });
  });

  describe("Response Format", () => {
    it("should return correct response structure for new cart", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockFindOrCreateCustomer.mockResolvedValue({
        customer: {
          customer_id: "cust-123",
          external_code: "CUST-001",
          addresses: [{ address_id: "addr-123", external_code: "ADDR-001" }],
        },
        isNew: false,
      });
      mockOrderCountDocuments.mockResolvedValue(0);
      mockOrderCreate.mockResolvedValue({
        order_id: "new-cart-123",
        customer_id: "cust-123",
        customer_code: "CUST-001",
        shipping_address_id: "addr-123",
        shipping_address_code: "ADDR-001",
        is_current: true,
        status: "draft",
        items: [],
      });

      const req = createMockRequest({
        customer_code: "CUST-001",
        address_code: "ADDR-001",
      });
      const response = await POST(req);
      const data = await response.json();

      expect(data).toMatchObject({
        success: true,
        cart_id: expect.any(String),
        order_id: expect.any(String),
        is_new: true,
        customer: {
          customer_id: "cust-123",
          customer_code: "CUST-001",
          is_new: expect.any(Boolean),
        },
        address: {
          address_id: "addr-123",
          address_code: "ADDR-001",
          is_new: expect.any(Boolean),
        },
        order: expect.any(Object),
      });
    });

    it("should return correct response structure for existing cart", async () => {
      const existingCart = {
        order_id: "existing-123",
        customer_id: "cust-123",
        customer_code: "CUST-001",
        shipping_address_id: "addr-123",
        shipping_address_code: "ADDR-001",
        is_current: true,
        status: "draft",
        items: [{ entity_code: "PROD-001" }],
      };
      mockOrderFindOne.mockResolvedValue(existingCart);

      const req = createMockRequest({
        customer_code: "CUST-001",
        address_code: "ADDR-001",
      });
      const response = await POST(req);
      const data = await response.json();

      expect(data).toMatchObject({
        success: true,
        cart_id: "existing-123",
        order_id: "existing-123",
        is_new: false,
        customer: {
          customer_id: "cust-123",
          customer_code: "CUST-001",
          is_new: false,
        },
        address: {
          address_id: "addr-123",
          address_code: "ADDR-001",
          is_new: false,
        },
        order: expect.objectContaining({
          items: expect.any(Array),
        }),
      });
    });
  });
});
