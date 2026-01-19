/**
 * Unit Tests for Customer Service
 *
 * Tests for findOrCreateCustomer and findOrCreateAddress functions.
 * Integration tests that verify database lookup and creation logic.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  CustomerFactory,
  AddressFactory,
} from "../conftest";

// Mock connection - must be before imports
vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() => Promise.resolve({
      Customer: CustomerModel,
    })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

// Import after mocks
import {
  findOrCreateCustomer,
  findOrCreateAddress,
  findCustomerById,
} from "@/lib/services/customer.service";
import { CustomerModel, ICustomer } from "@/lib/db/models/customer";

// ============================================
// TEST SETUP
// ============================================

describe("unit: Customer Service", () => {
  const TEST_TENANT = "test-tenant";

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
  // findOrCreateCustomer
  // ============================================

  describe("findOrCreateCustomer", () => {
    describe("lookup by customer_id (internal ID)", () => {
      it("should find existing customer by customer_id", async () => {
        /**
         * Priority 1: Lookup by internal customer_id.
         */
        // Arrange
        const existingCustomer = await CustomerModel.create({
          customer_id: "existing-123",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "existing@example.com",
          company_name: "Existing Company",
          addresses: [],
        });

        // Act
        const result = await findOrCreateCustomer(TEST_TENANT, {
          customer_id: "existing-123",
        });

        // Assert
        expect(result.customer.customer_id).toBe("existing-123");
        expect(result.customer.email).toBe("existing@example.com");
        expect(result.isNew).toBe(false);
      });

      it("should not find customer with wrong tenant_id", async () => {
        /**
         * Tenant isolation: customer_id lookup should respect tenant_id.
         */
        // Arrange
        await CustomerModel.create({
          customer_id: "tenant-test-1",
          tenant_id: "other-tenant",
          customer_type: "business",
          email: "other@example.com",
          addresses: [],
        });

        // Act & Assert
        await expect(
          findOrCreateCustomer(TEST_TENANT, {
            customer_id: "tenant-test-1",
          })
        ).rejects.toThrow("Customer not found");
      });
    });

    describe("lookup by customer_code (external_code)", () => {
      it("should find existing customer by external_code", async () => {
        /**
         * Priority 2: Lookup by ERP/external code.
         */
        // Arrange
        await CustomerModel.create({
          customer_id: "internal-456",
          external_code: "CLI-001",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "erp@example.com",
          company_name: "ERP Customer",
          addresses: [],
        });

        // Act
        const result = await findOrCreateCustomer(TEST_TENANT, {
          customer_code: "CLI-001",
        });

        // Assert
        expect(result.customer.customer_id).toBe("internal-456");
        expect(result.customer.external_code).toBe("CLI-001");
      });
    });

    describe("lookup by customer object", () => {
      it("should find customer by external_code in customer object", async () => {
        /**
         * Priority 3a: Lookup by external_code in customer object.
         */
        // Arrange
        await CustomerModel.create({
          customer_id: "lookup-by-obj-1",
          external_code: "EXT-123",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "objlookup@example.com",
          addresses: [],
        });

        // Act
        const result = await findOrCreateCustomer(TEST_TENANT, {
          customer: {
            external_code: "EXT-123",
            email: "different@example.com", // Different email but same external_code
          },
        });

        // Assert
        expect(result.customer.customer_id).toBe("lookup-by-obj-1");
      });

      it("should find business customer by VAT number", async () => {
        /**
         * Priority 3b: Lookup by VAT number for business customers.
         */
        // Arrange
        await CustomerModel.create({
          customer_id: "vat-lookup-1",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "vat@example.com",
          company_name: "VAT Company",
          legal_info: {
            vat_number: "IT12345678901",
          },
          addresses: [],
        });

        // Act
        const result = await findOrCreateCustomer(TEST_TENANT, {
          customer: {
            email: "newcustomer@example.com",
            customer_type: "business",
            legal_info: {
              vat_number: "IT12345678901",
            },
          },
        });

        // Assert
        expect(result.customer.customer_id).toBe("vat-lookup-1");
        expect(result.customer.legal_info?.vat_number).toBe("IT12345678901");
      });

      it("should create new customer when not found", async () => {
        /**
         * Priority 3c: Create new customer when no match found.
         */
        // Arrange
        const customerInput = {
          external_code: "NEW-001",
          email: "newcustomer@example.com",
          customer_type: "business" as const,
          company_name: "New Company Srl",
          phone: "+39 02 1234567",
          legal_info: {
            vat_number: "IT99988877766",
            pec_email: "newcompany@pec.it",
            sdi_code: "ABC1234",
          },
        };

        // Act
        const result = await findOrCreateCustomer(TEST_TENANT, {
          customer: customerInput,
        });

        // Assert
        expect(result.customer.customer_id).toBeDefined();
        expect(result.customer.customer_id).toHaveLength(12); // nanoid(12)
        expect(result.customer.tenant_id).toBe(TEST_TENANT);
        expect(result.customer.external_code).toBe("NEW-001");
        expect(result.customer.email).toBe("newcustomer@example.com");
        expect(result.customer.company_name).toBe("New Company Srl");
        expect(result.customer.legal_info?.vat_number).toBe("IT99988877766");

        // Verify in database
        const dbCustomer = await CustomerModel.findOne({
          tenant_id: TEST_TENANT,
          email: "newcustomer@example.com",
        });
        expect(dbCustomer).not.toBeNull();
      });

      it("should create customer with addresses", async () => {
        /**
         * Test creating customer with initial addresses.
         */
        // Arrange
        const customerInput = {
          email: "withaddress@example.com",
          customer_type: "business" as const,
          company_name: "Address Test Company",
          addresses: [
            {
              address_type: "both" as const,
              label: "Sede Legale",
              recipient_name: "Address Test Company",
              street_address: "Via Roma 1",
              city: "Milano",
              province: "MI",
              postal_code: "20100",
              country: "IT",
              is_default: true,
            },
          ],
        };

        // Act
        const result = await findOrCreateCustomer(TEST_TENANT, {
          customer: customerInput,
        });

        // Assert
        expect(result.customer.addresses).toHaveLength(1);
        expect(result.customer.addresses[0].address_id).toBeDefined();
        expect(result.customer.addresses[0].address_id).toHaveLength(8); // nanoid(8)
        expect(result.customer.addresses[0].city).toBe("Milano");
        expect(result.customer.default_shipping_address_id).toBe(result.customer.addresses[0].address_id);
      });
    });

    describe("error handling", () => {
      it("should throw error when no customer identifier provided", async () => {
        /**
         * Error case: No lookup criteria provided.
         */
        // Act & Assert
        await expect(
          findOrCreateCustomer(TEST_TENANT, {})
        ).rejects.toThrow("Customer not found and no data to create");
      });

      it("should throw error when customer_id not found and no customer object", async () => {
        /**
         * Error case: customer_id not found and no fallback data.
         */
        // Act & Assert
        await expect(
          findOrCreateCustomer(TEST_TENANT, {
            customer_id: "nonexistent-id",
          })
        ).rejects.toThrow("Customer not found");
      });
    });

    describe("lookup priority", () => {
      it("should prefer customer_id over customer_code", async () => {
        /**
         * Verify lookup priority: customer_id > customer_code.
         */
        // Arrange
        await CustomerModel.create({
          customer_id: "priority-1",
          external_code: "CLI-PRIORITY",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "priority1@example.com",
          addresses: [],
        });
        await CustomerModel.create({
          customer_id: "priority-2",
          external_code: "CLI-OTHER",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "priority2@example.com",
          addresses: [],
        });

        // Act - provide both customer_id and customer_code
        const result = await findOrCreateCustomer(TEST_TENANT, {
          customer_id: "priority-1",
          customer_code: "CLI-OTHER", // This should be ignored
        });

        // Assert - should find by customer_id
        expect(result.customer.customer_id).toBe("priority-1");
        expect(result.customer.email).toBe("priority1@example.com");
      });
    });
  });

  // ============================================
  // findOrCreateAddress
  // ============================================

  describe("findOrCreateAddress", () => {
    let testCustomer: ICustomer;

    beforeEach(async () => {
      // Create a customer with one address for address tests
      testCustomer = await CustomerModel.create({
        customer_id: "addr-test-customer",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "addrtest@example.com",
        addresses: [
          {
            address_id: "existing-addr-1",
            external_code: "ERP-ADDR-001",
            address_type: "delivery",
            label: "Main Warehouse",
            is_default: true,
            recipient_name: "Test Warehouse",
            street_address: "Via Logistica 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        default_shipping_address_id: "existing-addr-1",
      });
    });

    describe("lookup by address_id (internal ID)", () => {
      it("should find existing address by address_id", async () => {
        /**
         * Priority 1: Lookup by internal address_id.
         */
        // Act
        const result = await findOrCreateAddress(testCustomer, {
          address_id: "existing-addr-1",
        });

        // Assert
        expect(result.address_id).toBe("existing-addr-1");
        expect(result.city).toBe("Milano");
      });
    });

    describe("lookup by external_code", () => {
      it("should find existing address by external_code", async () => {
        /**
         * Priority 2a: Lookup by ERP/external code in address object.
         */
        // Act
        const result = await findOrCreateAddress(testCustomer, {
          address: {
            external_code: "ERP-ADDR-001",
            recipient_name: "Updated Name", // Different name but same code
            street_address: "Updated Street",
            city: "Roma",
            province: "RM",
            postal_code: "00100",
          },
        });

        // Assert - should return existing address, not create new
        expect(result.address_id).toBe("existing-addr-1");
        expect(result.city).toBe("Milano"); // Original city, not updated
      });
    });

    describe("create new address", () => {
      it("should create new address when not found", async () => {
        /**
         * Priority 2b: Create new address when no match found.
         */
        // Arrange
        const addressInput = {
          external_code: "NEW-ADDR-001",
          address_type: "delivery" as const,
          label: "New Branch",
          recipient_name: "Branch Office",
          street_address: "Via Nuova 10",
          city: "Roma",
          province: "RM",
          postal_code: "00100",
          country: "IT",
          phone: "+39 06 1234567",
        };

        // Act
        const result = await findOrCreateAddress(testCustomer, {
          address: addressInput,
        });

        // Assert
        expect(result.address_id).toBeDefined();
        expect(result.address_id).toHaveLength(8); // nanoid(8)
        expect(result.city).toBe("Roma");
        expect(result.external_code).toBe("NEW-ADDR-001");

        // Verify customer was updated
        const updatedCustomer = await CustomerModel.findOne({
          customer_id: "addr-test-customer",
        });
        expect(updatedCustomer?.addresses).toHaveLength(2);
      });

      it("should default country to IT", async () => {
        /**
         * Test default country value.
         */
        // Arrange
        const addressInput = {
          recipient_name: "No Country Specified",
          street_address: "Via Test 1",
          city: "Torino",
          province: "TO",
          postal_code: "10100",
          // No country specified
        };

        // Act
        const result = await findOrCreateAddress(testCustomer, {
          address: addressInput,
        });

        // Assert
        expect(result.country).toBe("IT");
      });
    });

    describe("fallback to default address", () => {
      it("should return default address when no lookup criteria", async () => {
        /**
         * Priority 3: Return default address if exists.
         */
        // Act
        const result = await findOrCreateAddress(testCustomer, {});

        // Assert
        expect(result.address_id).toBe("existing-addr-1");
        expect(result.is_default).toBe(true);
      });

      it("should return first address when no default exists", async () => {
        /**
         * Priority 4: Return first address if no default.
         */
        // Arrange - create customer with non-default address
        const customerNoDefault = await CustomerModel.create({
          customer_id: "no-default-customer",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "nodefault@example.com",
          addresses: [
            {
              address_id: "non-default-addr",
              address_type: "delivery",
              is_default: false,
              recipient_name: "Non Default",
              street_address: "Via Test",
              city: "Milano",
              province: "MI",
              postal_code: "20100",
              country: "IT",
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

        // Act
        const result = await findOrCreateAddress(customerNoDefault, {});

        // Assert
        expect(result.address_id).toBe("non-default-addr");
      });
    });

    describe("error handling", () => {
      it("should throw error when no address exists and no input provided", async () => {
        /**
         * Error case: Customer has no addresses and no input to create.
         */
        // Arrange - customer with no addresses
        const emptyCustomer = await CustomerModel.create({
          customer_id: "empty-addr-customer",
          tenant_id: TEST_TENANT,
          customer_type: "business",
          email: "emptyaddr@example.com",
          addresses: [],
        });

        // Act & Assert
        await expect(
          findOrCreateAddress(emptyCustomer, {})
        ).rejects.toThrow("Address not found and no data to create");
      });
    });
  });

  // ============================================
  // Business Info (Legal Info) Scenarios
  // ============================================

  describe("Business Info (legal_info)", () => {
    it("should create customer with full Italian e-invoicing legal_info", async () => {
      /**
       * Test creating business customer with complete legal info.
       * P.IVA, Codice Fiscale, PEC, SDI code.
       */
      // Arrange
      const customerInput = {
        email: "fullegal@example.com",
        customer_type: "business" as const,
        company_name: "Full Legal Company Srl",
        legal_info: {
          vat_number: "IT12345678901",
          fiscal_code: "12345678901",
          pec_email: "fullegal@pec.it",
          sdi_code: "ABC1234",
        },
      };

      // Act
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: customerInput,
      });

      // Assert
      expect(result.customer.legal_info).toBeDefined();
      expect(result.customer.legal_info?.vat_number).toBe("IT12345678901");
      expect(result.customer.legal_info?.fiscal_code).toBe("12345678901");
      expect(result.customer.legal_info?.pec_email).toBe("fullegal@pec.it");
      expect(result.customer.legal_info?.sdi_code).toBe("ABC1234");
    });

    it("should create private customer without legal_info", async () => {
      /**
       * Private customers may not have VAT/business info.
       */
      // Arrange
      const customerInput = {
        email: "private@example.com",
        customer_type: "private" as const,
        first_name: "Mario",
        last_name: "Rossi",
        phone: "+39 333 1234567",
      };

      // Act
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: customerInput,
      });

      // Assert
      expect(result.customer.customer_type).toBe("private");
      expect(result.customer.first_name).toBe("Mario");
      expect(result.customer.last_name).toBe("Rossi");
      expect(result.customer.legal_info).toBeUndefined();
    });

    it("should create reseller customer with legal_info", async () => {
      /**
       * Reseller customers need business info for B2B operations.
       */
      // Arrange
      const customerInput = {
        email: "reseller@example.com",
        customer_type: "reseller" as const,
        company_name: "Reseller Distribution Srl",
        legal_info: {
          vat_number: "IT99988877766",
          sdi_code: "XYZ9876",
        },
      };

      // Act
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: customerInput,
      });

      // Assert
      expect(result.customer.customer_type).toBe("reseller");
      expect(result.customer.company_name).toBe("Reseller Distribution Srl");
      expect(result.customer.legal_info?.vat_number).toBe("IT99988877766");
    });

    it("should NOT find customer by fiscal_code alone (only VAT lookup)", async () => {
      /**
       * The service only looks up by VAT number, not fiscal code.
       * This is intentional - fiscal code is not unique enough.
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "fiscal-test-1",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "fiscal@example.com",
        legal_info: {
          fiscal_code: "RSSMRA80A01H501U",
        },
        addresses: [],
      });

      // Act - try to find by fiscal_code (should NOT work, will create new)
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: {
          email: "newfiscal@example.com",
          customer_type: "business" as const,
          legal_info: {
            fiscal_code: "RSSMRA80A01H501U",
          },
        },
      });

      // Assert - should create NEW customer, not find existing
      expect(result.customer.customer_id).not.toBe("fiscal-test-1");
      expect(result.customer.email).toBe("newfiscal@example.com");
    });

    it("should update existing customer's legal_info via lookup", async () => {
      /**
       * When found by VAT, the existing customer is returned
       * (not updated - this is lookup only, not upsert).
       */
      // Arrange
      await CustomerModel.create({
        customer_id: "vat-update-test",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "vatupdate@example.com",
        company_name: "Original Company",
        legal_info: {
          vat_number: "IT55544433322",
        },
        addresses: [],
      });

      // Act - lookup with same VAT but different company name
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: {
          email: "different@example.com",
          customer_type: "business" as const,
          company_name: "Different Company Name",
          legal_info: {
            vat_number: "IT55544433322",
          },
        },
      });

      // Assert - returns existing, not updated
      expect(result.customer.customer_id).toBe("vat-update-test");
      expect(result.customer.company_name).toBe("Original Company"); // Not changed
    });
  });

  // ============================================
  // Multiple Addresses Scenarios
  // ============================================

  describe("Multiple Addresses", () => {
    it("should create customer with multiple addresses", async () => {
      /**
       * Business customers often have multiple delivery locations.
       */
      // Arrange
      const customerInput = {
        email: "multiaddr@example.com",
        customer_type: "business" as const,
        company_name: "Multi Location Company",
        addresses: [
          {
            address_type: "both" as const,
            label: "Sede Legale",
            is_default: true,
            recipient_name: "Multi Location Company",
            street_address: "Via Roma 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
          },
          {
            address_type: "delivery" as const,
            label: "Magazzino Nord",
            is_default: false,
            recipient_name: "Multi Location - Warehouse",
            street_address: "Via Logistica 10",
            city: "Torino",
            province: "TO",
            postal_code: "10100",
          },
          {
            address_type: "delivery" as const,
            label: "Magazzino Sud",
            is_default: false,
            recipient_name: "Multi Location - South",
            street_address: "Via Industria 5",
            city: "Napoli",
            province: "NA",
            postal_code: "80100",
          },
        ],
      };

      // Act
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: customerInput,
      });

      // Assert
      expect(result.customer.addresses).toHaveLength(3);
      expect(result.customer.addresses[0].label).toBe("Sede Legale");
      expect(result.customer.addresses[1].label).toBe("Magazzino Nord");
      expect(result.customer.addresses[2].label).toBe("Magazzino Sud");
      expect(result.customer.default_shipping_address_id).toBe(result.customer.addresses[0].address_id);
    });

    it("should add new address with full details", async () => {
      /**
       * Test address creation with all optional fields.
       */
      // Arrange
      const customer = await CustomerModel.create({
        customer_id: "full-addr-customer",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "fulladdr@example.com",
        addresses: [],
      });

      const addressInput = {
        external_code: "ERP-FULL-001",
        address_type: "delivery" as const,
        label: "Complete Address",
        is_default: true,
        recipient_name: "Full Details Recipient",
        street_address: "Via Completa 123",
        street_address_2: "Piano 3, Scala B",
        city: "Firenze",
        province: "FI",
        postal_code: "50100",
        country: "IT",
        phone: "+39 055 1234567",
        delivery_notes: "Chiamare prima della consegna. Citofono 3B.",
      };

      // Act
      const result = await findOrCreateAddress(customer, {
        address: addressInput,
      });

      // Assert
      expect(result.external_code).toBe("ERP-FULL-001");
      expect(result.label).toBe("Complete Address");
      expect(result.street_address_2).toBe("Piano 3, Scala B");
      expect(result.phone).toBe("+39 055 1234567");
      expect(result.delivery_notes).toBe("Chiamare prima della consegna. Citofono 3B.");
    });

    it("should handle billing-only address type", async () => {
      /**
       * Some addresses are only for billing, not delivery.
       */
      // Arrange
      const customer = await CustomerModel.create({
        customer_id: "billing-addr-customer",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "billingaddr@example.com",
        addresses: [],
      });

      // Act
      const result = await findOrCreateAddress(customer, {
        address: {
          address_type: "billing",
          label: "Sede Amministrativa",
          recipient_name: "Ufficio Amministrazione",
          street_address: "Via Fatture 1",
          city: "Roma",
          province: "RM",
          postal_code: "00100",
        },
      });

      // Assert
      expect(result.address_type).toBe("billing");
    });

    it("should set first address as default if is_default not specified", async () => {
      /**
       * First address should automatically become default.
       */
      // Arrange
      const customerInput = {
        email: "autodefault@example.com",
        customer_type: "business" as const,
        company_name: "Auto Default Company",
        addresses: [
          {
            recipient_name: "First Address",
            street_address: "Via Prima 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            // is_default NOT specified
          },
        ],
      };

      // Act
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: customerInput,
      });

      // Assert
      expect(result.customer.addresses[0].is_default).toBe(true);
      expect(result.customer.default_shipping_address_id).toBe(result.customer.addresses[0].address_id);
    });

    it("should add second address and keep first as default", async () => {
      /**
       * Adding a non-default address shouldn't change the default.
       */
      // Arrange
      const customer = await CustomerModel.create({
        customer_id: "second-addr-customer",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "secondaddr@example.com",
        addresses: [
          {
            address_id: "first-addr",
            address_type: "both",
            is_default: true,
            recipient_name: "First",
            street_address: "Via Prima",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        default_shipping_address_id: "first-addr",
      });

      // Act
      const result = await findOrCreateAddress(customer, {
        address: {
          is_default: false,
          recipient_name: "Second",
          street_address: "Via Seconda",
          city: "Roma",
          province: "RM",
          postal_code: "00100",
        },
      });

      // Assert - new address added, first remains default
      expect(result.is_default).toBe(false);
      const updatedCustomer = await CustomerModel.findOne({ customer_id: "second-addr-customer" });
      expect(updatedCustomer?.default_shipping_address_id).toBe("first-addr");
    });
  });

  // ============================================
  // Integration Scenarios
  // ============================================

  describe("Integration: Full Customer + Address + Business Info", () => {
    it("should create complete B2B customer profile", async () => {
      /**
       * Full B2B customer creation with all components.
       */
      // Arrange
      const customerInput = {
        external_code: "ERP-CLI-001",
        email: "complete@company.it",
        customer_type: "business" as const,
        company_name: "Complete Company SpA",
        phone: "+39 02 9876543",
        legal_info: {
          vat_number: "IT11223344556",
          fiscal_code: "11223344556",
          pec_email: "complete@pec.it",
          sdi_code: "PEC1234",
        },
        addresses: [
          {
            external_code: "ERP-ADDR-HQ",
            address_type: "both" as const,
            label: "Headquarters",
            is_default: true,
            recipient_name: "Complete Company SpA",
            street_address: "Viale Europa 100",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            phone: "+39 02 1111111",
          },
          {
            external_code: "ERP-ADDR-WH",
            address_type: "delivery" as const,
            label: "Warehouse",
            is_default: false,
            recipient_name: "Complete Company - Magazzino",
            street_address: "Via Logistica 50",
            city: "Bergamo",
            province: "BG",
            postal_code: "24100",
            country: "IT",
            phone: "+39 035 2222222",
            delivery_notes: "Orario ricezione: 8-12, 14-17",
          },
        ],
      };

      // Act
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: customerInput,
      });

      // Assert - Customer
      expect(result.customer.customer_id).toBeDefined();
      expect(result.customer.external_code).toBe("ERP-CLI-001");
      expect(result.customer.company_name).toBe("Complete Company SpA");

      // Assert - Legal Info
      expect(result.customer.legal_info?.vat_number).toBe("IT11223344556");
      expect(result.customer.legal_info?.pec_email).toBe("complete@pec.it");

      // Assert - Addresses
      expect(result.customer.addresses).toHaveLength(2);
      expect(result.customer.addresses[0].external_code).toBe("ERP-ADDR-HQ");
      expect(result.customer.addresses[1].external_code).toBe("ERP-ADDR-WH");
      expect(result.customer.addresses[1].delivery_notes).toBe("Orario ricezione: 8-12, 14-17");

      // Assert - Defaults
      expect(result.customer.default_shipping_address_id).toBe(result.customer.addresses[0].address_id);
    });

    it("should lookup existing customer and add new address", async () => {
      /**
       * Find customer by VAT, then add a new delivery address.
       */
      // Arrange - Create existing customer
      const existingCustomer = await CustomerModel.create({
        customer_id: "existing-for-addr",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "existing@company.it",
        company_name: "Existing Company",
        legal_info: {
          vat_number: "IT66677788899",
        },
        addresses: [
          {
            address_id: "existing-hq",
            address_type: "both",
            is_default: true,
            recipient_name: "Existing Company",
            street_address: "Via Esistente 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        default_shipping_address_id: "existing-hq",
      });

      // Act 1 - Find customer by VAT
      const { customer: foundCustomer, isNew } = await findOrCreateCustomer(TEST_TENANT, {
        customer: {
          email: "different@email.com",
          customer_type: "business" as const,
          legal_info: {
            vat_number: "IT66677788899",
          },
        },
      });

      // Assert - found existing
      expect(foundCustomer.customer_id).toBe("existing-for-addr");
      expect(isNew).toBe(false);

      // Act 2 - Add new address to found customer
      const newAddress = await findOrCreateAddress(foundCustomer, {
        address: {
          external_code: "NEW-BRANCH",
          address_type: "delivery",
          label: "New Branch Office",
          recipient_name: "Existing Company - Branch",
          street_address: "Via Nuova Filiale 10",
          city: "Torino",
          province: "TO",
          postal_code: "10100",
        },
      });

      // Assert - new address created
      expect(newAddress.address_id).toBeDefined();
      expect(newAddress.city).toBe("Torino");

      // Verify in database
      const updatedCustomer = await CustomerModel.findOne({ customer_id: "existing-for-addr" });
      expect(updatedCustomer?.addresses).toHaveLength(2);
    });

    it("should handle guest customer (minimal info)", async () => {
      /**
       * Guest customers have minimal info, often created during checkout.
       */
      // Arrange
      const guestInput = {
        email: "guest@checkout.com",
        customer_type: "private" as const,
        is_guest: true,
        first_name: "Guest",
        last_name: "User",
        addresses: [
          {
            address_type: "both" as const,
            recipient_name: "Guest User",
            street_address: "Via Temporanea 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
          },
        ],
      };

      // Act
      const result = await findOrCreateCustomer(TEST_TENANT, {
        customer: guestInput,
      });

      // Assert
      expect(result.customer.is_guest).toBe(true);
      expect(result.customer.customer_type).toBe("private");
      expect(result.customer.first_name).toBe("Guest");
      expect(result.customer.addresses).toHaveLength(1);
    });
  });

  // ============================================
  // findCustomerById
  // ============================================

  describe("findCustomerById", () => {
    beforeEach(async () => {
      await CustomerModel.create({
        customer_id: "find-by-id-1",
        external_code: "EXT-FIND-1",
        tenant_id: TEST_TENANT,
        customer_type: "business",
        email: "findbyid@example.com",
        addresses: [],
      });
    });

    it("should find customer by internal customer_id", async () => {
      /**
       * Test lookup by internal ID.
       */
      // Act
      const result = await findCustomerById(TEST_TENANT, "find-by-id-1");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.customer_id).toBe("find-by-id-1");
    });

    it("should find customer by external_code", async () => {
      /**
       * Test lookup by external code.
       */
      // Act
      const result = await findCustomerById(TEST_TENANT, undefined, "EXT-FIND-1");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.external_code).toBe("EXT-FIND-1");
    });

    it("should return null when customer not found", async () => {
      /**
       * Test null return for non-existent customer.
       */
      // Act
      const result = await findCustomerById(TEST_TENANT, "nonexistent");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when no parameters provided", async () => {
      /**
       * Test null return when no lookup criteria.
       */
      // Act
      const result = await findCustomerById(TEST_TENANT);

      // Assert
      expect(result).toBeNull();
    });

    it("should respect tenant isolation", async () => {
      /**
       * Test that customers from other tenants are not returned.
       */
      // Act
      const result = await findCustomerById("other-tenant", "find-by-id-1");

      // Assert
      expect(result).toBeNull();
    });
  });
});
