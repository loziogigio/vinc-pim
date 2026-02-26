/**
 * Customer API Integration Tests
 *
 * Tests for customer CRUD operations and address management.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  CustomerFactory,
  AddressFactory,
  createParams,
} from "../conftest";

// Mock connection - must be before imports
vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { OrderModel } = await import("@/lib/db/models/order");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() => Promise.resolve({
      Customer: CustomerModel,
      Order: OrderModel,
    })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

// Mock session auth
vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(() =>
    Promise.resolve({
      isLoggedIn: true,
      userId: "test-user",
      tenantId: "test-tenant",
    })
  ),
}));

// Mock API key auth to bypass real API key verification
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(() =>
    Promise.resolve({
      authenticated: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
    })
  ),
}));

// Mock portal user token (no portal user restrictions for these tests)
vi.mock("@/lib/auth/portal-user-token", () => ({
  getPortalUserFromRequest: vi.fn(() => Promise.resolve(null)),
  getAccessibleCustomerIds: vi.fn(() => Promise.resolve(null)),
  hasCustomerAccess: vi.fn(() => true), // Allow access to all customers
}));

// Import after mocks
import { GET as listCustomers, POST as createCustomer } from "@/app/api/b2b/customers/route";
import {
  GET as getCustomer,
  PATCH as updateCustomer,
  DELETE as deleteCustomer,
} from "@/app/api/b2b/customers/[id]/route";
import { POST as addAddress } from "@/app/api/b2b/customers/[id]/addresses/route";
import {
  PATCH as updateAddress,
  DELETE as deleteAddress,
} from "@/app/api/b2b/customers/[id]/addresses/[address_id]/route";
import { CustomerModel } from "@/lib/db/models/customer";
import { CounterModel } from "@/lib/db/models/counter";

// ============================================
// TEST SETUP
// ============================================

describe("integration: Customers API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // ============================================
  // POST /api/b2b/customers - Create Customer
  // ============================================

  describe("POST /api/b2b/customers", () => {
    it("should create business customer with valid payload", async () => {
      /**
       * Test creating a business customer.
       * Verifies customer_id generation and default values.
       */
      // Arrange
      const payload = CustomerFactory.createPayload();
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.customer.customer_id).toBeDefined();
      expect(data.customer.customer_type).toBe("business");
      expect(data.customer.email).toBe(payload.email);
      expect(data.customer.tenant_id).toBe("test-tenant");
    });

    it("should create customer with legal info", async () => {
      /**
       * Test creating customer with Italian e-invoicing data.
       */
      // Arrange
      const payload = CustomerFactory.createWithLegalInfo();
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.customer.legal_info.vat_number).toBe("IT12345678901");
      expect(data.customer.legal_info.sdi_code).toBe("ABC1234");
    });

    it("should create customer with embedded address", async () => {
      /**
       * Test creating customer with initial address.
       * Verifies address_id is generated and default is set.
       */
      // Arrange
      const payload = CustomerFactory.createWithAddress();
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.customer.addresses).toHaveLength(1);
      expect(data.customer.addresses[0].address_id).toBeDefined();
      expect(data.customer.addresses[0].address_id).toHaveLength(8);
      expect(data.customer.default_shipping_address_id).toBe(
        data.customer.addresses[0].address_id
      );
    });

    it("should return 400 when customer_type is missing", async () => {
      /**
       * Test validation: customer_type is required.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("customer_type");
    });

    it("should return 400 when email is missing", async () => {
      /**
       * Test validation: email is required.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify({ customer_type: "business" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("email");
    });

    it("should return 409 for duplicate email", async () => {
      /**
       * Test that duplicate emails are rejected within same tenant.
       */
      // Arrange
      const payload = CustomerFactory.createPayload();
      const req1 = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Create first customer
      await createCustomer(req1);

      // Try to create duplicate
      const req2 = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req2);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(409);
      expect(data.error).toContain("already exists");
    });

    it("should return 400 for invalid VAT number", async () => {
      /**
       * Test validation: VAT number format.
       */
      // Arrange
      const payload = CustomerFactory.createPayload({
        legal_info: { vat_number: "INVALID" },
      });
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid legal info");
    });

    // ============================================
    // Public Code Auto-Generation Tests
    // ============================================

    it("should auto-generate public_code when not provided", async () => {
      /**
       * Test that public_code is auto-generated in format C-XXXXX.
       * First customer should get C-00001.
       */
      // Arrange
      const payload = CustomerFactory.createPayload();
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.customer.public_code).toBeDefined();
      expect(data.customer.public_code).toMatch(/^C-\d{5}$/);
      expect(data.customer.public_code).toBe("C-00001");
    });

    it("should increment public_code for each new customer", async () => {
      /**
       * Test sequential public_code generation.
       * C-00001 → C-00002 → C-00003
       */
      // Arrange & Act - Create 3 customers
      const customers = [];
      for (let i = 0; i < 3; i++) {
        const payload = CustomerFactory.createPayload();
        const req = new NextRequest("http://localhost/api/b2b/customers", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
            "x-auth-method": "api-key",
          },
        });
        const res = await createCustomer(req);
        const data = await res.json();
        customers.push(data.customer);
      }

      // Assert
      expect(customers[0].public_code).toBe("C-00001");
      expect(customers[1].public_code).toBe("C-00002");
      expect(customers[2].public_code).toBe("C-00003");
    });

    it("should use custom public_code when provided", async () => {
      /**
       * Test that custom public_code is preserved.
       */
      // Arrange
      const payload = CustomerFactory.createPayload({
        public_code: "CUSTOM-001",
      });
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.customer.public_code).toBe("CUSTOM-001");
    });

    it("should continue auto-generation after custom code", async () => {
      /**
       * Test that auto-generation continues correctly after custom codes.
       * C-00001 → CUSTOM → C-00002
       */
      // Arrange & Act
      // First: auto-generated
      const req1 = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(CustomerFactory.createPayload()),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });
      const res1 = await createCustomer(req1);
      const data1 = await res1.json();

      // Second: custom
      const req2 = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(CustomerFactory.createPayload({ public_code: "CUSTOM-XYZ" })),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });
      const res2 = await createCustomer(req2);
      const data2 = await res2.json();

      // Third: auto-generated (should continue from counter)
      const req3 = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(CustomerFactory.createPayload()),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });
      const res3 = await createCustomer(req3);
      const data3 = await res3.json();

      // Assert
      expect(data1.customer.public_code).toBe("C-00001");
      expect(data2.customer.public_code).toBe("CUSTOM-XYZ");
      expect(data3.customer.public_code).toBe("C-00002");
    });

    it("should create customer with external_code (ERP code)", async () => {
      /**
       * Test creating customer with external ERP code.
       */
      // Arrange
      const payload = CustomerFactory.createPayload({
        external_code: "ERP-12345",
      });
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.customer.external_code).toBe("ERP-12345");
      expect(data.customer.public_code).toBeDefined(); // Also auto-generated
    });

    // ============================================
    // External Code Auto-Generation Tests
    // ============================================

    it("should auto-generate customer external_code from customer_id when not provided", async () => {
      /**
       * When external_code is not provided, it should default to customer_id.
       */
      // Arrange
      const payload = CustomerFactory.createPayload();
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.customer.external_code).toBeDefined();
      expect(data.customer.external_code).toBe(data.customer.customer_id);
    });

    it("should auto-generate address external_code from address_id when not provided", async () => {
      /**
       * When address external_code is not provided, it should default to address_id.
       */
      // Arrange
      const payload = CustomerFactory.createWithAddress();
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      const addr = data.customer.addresses[0];
      expect(addr.external_code).toBeDefined();
      expect(addr.external_code).toBe(addr.address_id);
    });

    it("should preserve explicit external_code and not overwrite with ID", async () => {
      /**
       * When external_code is explicitly provided, it should be used as-is.
       */
      // Arrange
      const payload = CustomerFactory.createPayload({
        external_code: "MY-ERP-CODE",
        addresses: [
          {
            address_type: "both",
            recipient_name: "Test",
            street_address: "Via Roma 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            is_default: true,
            external_code: "ADDR-ERP-001",
          },
        ],
      });
      const req = new NextRequest("http://localhost/api/b2b/customers", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCustomer(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.customer.external_code).toBe("MY-ERP-CODE");
      expect(data.customer.addresses[0].external_code).toBe("ADDR-ERP-001");
    });
  });

  // ============================================
  // GET /api/b2b/customers - List Customers
  // ============================================

  describe("GET /api/b2b/customers", () => {
    it("should list customers with pagination", async () => {
      /**
       * Test listing customers with default pagination.
       */
      // Arrange - Create 3 customers
      for (let i = 0; i < 3; i++) {
        await CustomerModel.create({
          customer_id: `test-${i}`,
          tenant_id: "test-tenant",
          customer_type: "business",
          email: `test-${i}@example.com`,
          company_name: `Company ${i}`,
          addresses: [],
        });
      }

      const req = new NextRequest("http://localhost/api/b2b/customers", {
        headers: { "x-auth-method": "api-key" },
      });

      // Act
      const res = await listCustomers(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.customers).toHaveLength(3);
      expect(data.pagination.total).toBe(3);
    });

    it("should filter by customer_type", async () => {
      /**
       * Test filtering customers by type.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "business-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "business@example.com",
        addresses: [],
      });
      await CustomerModel.create({
        customer_id: "private-1",
        tenant_id: "test-tenant",
        customer_type: "private",
        email: "private@example.com",
        addresses: [],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers?customer_type=business",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCustomers(req);
      const data = await res.json();

      // Assert
      expect(data.customers).toHaveLength(1);
      expect(data.customers[0].customer_type).toBe("business");
    });

    it("should search by email/name/company", async () => {
      /**
       * Test search functionality.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "search-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "findme@example.com",
        company_name: "Search Target",
        addresses: [],
      });
      await CustomerModel.create({
        customer_id: "search-2",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "other@example.com",
        company_name: "Other Company",
        addresses: [],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers?search=findme",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCustomers(req);
      const data = await res.json();

      // Assert
      expect(data.customers).toHaveLength(1);
      expect(data.customers[0].email).toBe("findme@example.com");
    });

    it("should search by public_code", async () => {
      /**
       * Test searching customers by public_code.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "search-public-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "public1@example.com",
        company_name: "Public Code Test 1",
        public_code: "C-00001",
        addresses: [],
      });
      await CustomerModel.create({
        customer_id: "search-public-2",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "public2@example.com",
        company_name: "Public Code Test 2",
        public_code: "C-00002",
        addresses: [],
      });
      await CustomerModel.create({
        customer_id: "search-public-3",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "custom@example.com",
        company_name: "Custom Code Test",
        public_code: "CUSTOM-XYZ",
        addresses: [],
      });

      // Act - Search for C-00001
      const req1 = new NextRequest(
        "http://localhost/api/b2b/customers?search=C-00001",
        { headers: { "x-auth-method": "api-key" } }
      );
      const res1 = await listCustomers(req1);
      const data1 = await res1.json();

      // Assert
      expect(data1.customers).toHaveLength(1);
      expect(data1.customers[0].public_code).toBe("C-00001");

      // Act - Search for CUSTOM
      const req2 = new NextRequest(
        "http://localhost/api/b2b/customers?search=CUSTOM",
        { headers: { "x-auth-method": "api-key" } }
      );
      const res2 = await listCustomers(req2);
      const data2 = await res2.json();

      // Assert
      expect(data2.customers).toHaveLength(1);
      expect(data2.customers[0].public_code).toBe("CUSTOM-XYZ");
    });

    it("should search by external_code (ERP code)", async () => {
      /**
       * Test searching customers by external ERP code.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "search-erp-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "erp1@example.com",
        company_name: "ERP Test 1",
        external_code: "ERP-12345",
        public_code: "C-00001",
        addresses: [],
      });
      await CustomerModel.create({
        customer_id: "search-erp-2",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "erp2@example.com",
        company_name: "ERP Test 2",
        external_code: "ERP-67890",
        public_code: "C-00002",
        addresses: [],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers?search=ERP-12345",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCustomers(req);
      const data = await res.json();

      // Assert
      expect(data.customers).toHaveLength(1);
      expect(data.customers[0].external_code).toBe("ERP-12345");
    });

    // ============================================
    // Filter by customer_code and address_code
    // ============================================

    it("should filter by customer_code (exact match on external_code)", async () => {
      /**
       * Test exact match filter using customer_code query param.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "code-filter-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "code1@example.com",
        external_code: "CLI-001",
        addresses: [],
      });
      await CustomerModel.create({
        customer_id: "code-filter-2",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "code2@example.com",
        external_code: "CLI-002",
        addresses: [],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers?customer_code=CLI-001",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCustomers(req);
      const data = await res.json();

      // Assert
      expect(data.customers).toHaveLength(1);
      expect(data.customers[0].external_code).toBe("CLI-001");
      expect(data.customers[0].customer_id).toBe("code-filter-1");
    });

    it("should filter by address_code (exact match on address external_code)", async () => {
      /**
       * Test exact match filter using address_code query param.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "addr-code-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "addrcode1@example.com",
        addresses: [
          {
            address_id: "a1",
            external_code: "ADDR-100",
            address_type: "both",
            is_default: true,
            recipient_name: "Test 1",
            street_address: "Via Roma 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });
      await CustomerModel.create({
        customer_id: "addr-code-2",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "addrcode2@example.com",
        addresses: [
          {
            address_id: "a2",
            external_code: "ADDR-200",
            address_type: "both",
            is_default: true,
            recipient_name: "Test 2",
            street_address: "Via Torino 2",
            city: "Roma",
            province: "RM",
            postal_code: "00100",
            country: "IT",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers?address_code=ADDR-200",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCustomers(req);
      const data = await res.json();

      // Assert
      expect(data.customers).toHaveLength(1);
      expect(data.customers[0].customer_id).toBe("addr-code-2");
    });

    it("should return empty when customer_code does not match", async () => {
      /**
       * Test that non-matching customer_code returns empty results.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "nomatch-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "nomatch@example.com",
        external_code: "CLI-999",
        addresses: [],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers?customer_code=NONEXISTENT",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCustomers(req);
      const data = await res.json();

      // Assert
      expect(data.customers).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });
  });

  // ============================================
  // GET /api/b2b/customers/[id] - Get Customer
  // ============================================

  describe("GET /api/b2b/customers/[id]", () => {
    it("should get customer by id", async () => {
      /**
       * Test fetching a single customer.
       */
      // Arrange
      const customer = await CustomerModel.create({
        customer_id: "get-test-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "get@example.com",
        company_name: "Get Test",
        addresses: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/customers/get-test-1");
      const params = createParams({ id: "get-test-1" });

      // Act
      const res = await getCustomer(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.customer.customer_id).toBe("get-test-1");
      expect(data.customer.email).toBe("get@example.com");
    });

    it("should get customer by external_code (fallback lookup)", async () => {
      /**
       * Test fetching a customer using external_code in the [id] param.
       * When customer_id lookup fails, it falls back to external_code.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "get-ext-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "getext@example.com",
        company_name: "External Code Lookup",
        external_code: "ERP-GET-001",
        addresses: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/customers/ERP-GET-001");
      const params = createParams({ id: "ERP-GET-001" });

      // Act
      const res = await getCustomer(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.customer.customer_id).toBe("get-ext-1");
      expect(data.customer.external_code).toBe("ERP-GET-001");
    });

    it("should return 404 for non-existent customer", async () => {
      /**
       * Test 404 for invalid customer_id.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/customers/nonexistent");
      const params = createParams({ id: "nonexistent" });

      // Act
      const res = await getCustomer(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  // ============================================
  // PATCH /api/b2b/customers/[id] - Update
  // ============================================

  describe("PATCH /api/b2b/customers/[id]", () => {
    it("should update customer fields", async () => {
      /**
       * Test updating customer email and phone.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "update-test-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "old@example.com",
        company_name: "Update Test",
        addresses: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/customers/update-test-1", {
        method: "PATCH",
        body: JSON.stringify({ email: "new@example.com", phone: "+39 333 1234567" }),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "update-test-1" });

      // Act
      const res = await updateCustomer(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.customer.email).toBe("new@example.com");
      expect(data.customer.phone).toBe("+39 333 1234567");
    });

    it("should update legal info", async () => {
      /**
       * Test updating customer legal info.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "legal-update-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "legal@example.com",
        addresses: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/customers/legal-update-1", {
        method: "PATCH",
        body: JSON.stringify({
          legal_info: {
            vat_number: "IT99988877766",
            sdi_code: "XYZ7890",
          },
        }),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "legal-update-1" });

      // Act
      const res = await updateCustomer(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.customer.legal_info.vat_number).toBe("IT99988877766");
    });
  });

  // ============================================
  // DELETE /api/b2b/customers/[id] - Delete
  // ============================================

  describe("DELETE /api/b2b/customers/[id]", () => {
    it("should delete customer", async () => {
      /**
       * Test deleting a customer.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "delete-test-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "delete@example.com",
        addresses: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/customers/delete-test-1");
      const params = createParams({ id: "delete-test-1" });

      // Act
      const res = await deleteCustomer(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify deletion
      const deleted = await CustomerModel.findOne({ customer_id: "delete-test-1" });
      expect(deleted).toBeNull();
    });
  });

  // ============================================
  // POST /api/b2b/customers/[id]/addresses
  // ============================================

  describe("POST /api/b2b/customers/[id]/addresses", () => {
    it("should add address to customer", async () => {
      /**
       * Test adding a new address to existing customer.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "addr-test-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "addr@example.com",
        addresses: [],
      });

      const addressPayload = AddressFactory.createPayload();
      const req = new NextRequest("http://localhost/api/b2b/customers/addr-test-1/addresses", {
        method: "POST",
        body: JSON.stringify(addressPayload),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "addr-test-1" });

      // Act
      const res = await addAddress(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.customer.addresses).toHaveLength(1);
      expect(data.address.address_id).toBeDefined();
      expect(data.address.city).toBe("Milano");
    });

    it("should set default address when is_default=true", async () => {
      /**
       * Test that default address IDs are set correctly.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "default-addr-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "default@example.com",
        addresses: [],
      });

      const addressPayload = AddressFactory.createPayload({
        address_type: "delivery",
        is_default: true,
      });
      const req = new NextRequest("http://localhost/api/b2b/customers/default-addr-1/addresses", {
        method: "POST",
        body: JSON.stringify(addressPayload),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "default-addr-1" });

      // Act
      const res = await addAddress(req, params);
      const data = await res.json();

      // Assert
      expect(data.customer.default_shipping_address_id).toBe(data.address.address_id);
    });

    it("should return 400 for missing required fields", async () => {
      /**
       * Test validation: address requires recipient_name, street_address, etc.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "valid-addr-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "valid@example.com",
        addresses: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/customers/valid-addr-1/addresses", {
        method: "POST",
        body: JSON.stringify({ address_type: "delivery" }),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "valid-addr-1" });

      // Act
      const res = await addAddress(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  // ============================================
  // PATCH /api/b2b/customers/[id]/addresses/[address_id]
  // ============================================

  describe("PATCH /api/b2b/customers/[id]/addresses/[address_id]", () => {
    it("should update address", async () => {
      /**
       * Test updating an existing address.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "upd-addr-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "updaddr@example.com",
        addresses: [
          {
            address_id: "addr-123",
            address_type: "delivery",
            recipient_name: "Old Name",
            street_address: "Old Street",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            is_default: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers/upd-addr-1/addresses/addr-123",
        {
          method: "PATCH",
          body: JSON.stringify({ recipient_name: "New Name", city: "Roma" }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const params = createParams({ id: "upd-addr-1", address_id: "addr-123" });

      // Act
      const res = await updateAddress(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      const updatedAddr = data.customer.addresses.find(
        (a: { address_id: string }) => a.address_id === "addr-123"
      );
      expect(updatedAddr.recipient_name).toBe("New Name");
      expect(updatedAddr.city).toBe("Roma");
    });
  });

  // ============================================
  // DELETE /api/b2b/customers/[id]/addresses/[address_id]
  // ============================================

  describe("DELETE /api/b2b/customers/[id]/addresses/[address_id]", () => {
    it("should remove address from customer", async () => {
      /**
       * Test deleting an address.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "del-addr-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "deladdr@example.com",
        addresses: [
          {
            address_id: "addr-del-1",
            address_type: "delivery",
            recipient_name: "To Delete",
            street_address: "Delete Street",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            is_default: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers/del-addr-1/addresses/addr-del-1"
      );
      const params = createParams({ id: "del-addr-1", address_id: "addr-del-1" });

      // Act
      const res = await deleteAddress(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.customer.addresses).toHaveLength(0);
    });

    it("should clear default_shipping_address_id when default is deleted", async () => {
      /**
       * Test that default address ID is cleared when deleted.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "del-default-1",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "deldefault@example.com",
        default_shipping_address_id: "addr-default-1",
        addresses: [
          {
            address_id: "addr-default-1",
            address_type: "delivery",
            recipient_name: "Default",
            street_address: "Default Street",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            is_default: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/customers/del-default-1/addresses/addr-default-1"
      );
      const params = createParams({ id: "del-default-1", address_id: "addr-default-1" });

      // Act
      const res = await deleteAddress(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.customer.default_shipping_address_id).toBeNull();
    });
  });
});
