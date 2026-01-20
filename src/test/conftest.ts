/**
 * Test Fixtures and Configuration
 *
 * Shared fixtures and utilities for all tests.
 * Equivalent to pytest's conftest.py
 */

import { vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

export interface TestSession {
  isLoggedIn: boolean;
  userId: string;
  customerId?: string;
}

// ============================================
// DATABASE SETUP
// ============================================

let mongoServer: MongoMemoryServer | null = null;

/**
 * Start in-memory MongoDB server.
 * Call in beforeAll() hook.
 */
export async function setupTestDatabase(): Promise<string> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return uri;
}

/**
 * Stop in-memory MongoDB server.
 * Call in afterAll() hook.
 */
export async function teardownTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Clear all collections.
 * Call in beforeEach() hook.
 */
export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

// ============================================
// SESSION MOCKING
// ============================================

/**
 * Create mock session for testing.
 * Default: logged in customer.
 */
export function createMockSession(overrides?: Partial<TestSession>): TestSession {
  return {
    isLoggedIn: true,
    userId: `test-customer-${nanoid(8)}`,
    ...overrides,
  };
}

// ============================================
// REQUEST HELPERS
// ============================================

/**
 * Create NextRequest for testing API routes.
 */
export function createRequest(
  method: string,
  body?: unknown,
  url = "http://localhost:3000/api/b2b/orders"
): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

/**
 * Create params promise for Next.js 15 route handlers.
 */
export function createParams<T extends Record<string, string>>(
  params: T
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

// ============================================
// FACTORIES
// ============================================

/**
 * Factory for creating test orders.
 */
export const OrderFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    return {
      customer_id: `test-customer-${nanoid(8)}`,
      price_list_id: "default",
      price_list_type: "wholesale",
      order_type: "b2b",
      currency: "EUR",
      ...overrides,
    };
  },
};

/**
 * Factory for creating test line items.
 */
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

  createMany(count: number, overrides?: Record<string, unknown>) {
    return Array.from({ length: count }, () => this.createPayload(overrides));
  },
};

/**
 * Factory for creating test customers.
 */
export const CustomerFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    const id = nanoid(6);
    return {
      customer_type: "business",
      email: `test-${id}@example.com`,
      company_name: `Test Company ${id}`,
      phone: "+39 02 1234567",
      ...overrides,
    };
  },

  createWithLegalInfo(overrides?: Record<string, unknown>) {
    return this.createPayload({
      legal_info: {
        vat_number: "IT12345678901",
        fiscal_code: "12345678901",
        pec_email: "test@pec.it",
        sdi_code: "ABC1234",
      },
      ...overrides,
    });
  },

  createWithAddress(overrides?: Record<string, unknown>) {
    return this.createPayload({
      addresses: [
        {
          address_type: "both",
          label: "Sede Legale",
          recipient_name: "Test Company",
          street_address: "Via Roma 1",
          city: "Milano",
          province: "MI",
          postal_code: "20100",
          country: "IT",
          is_default: true,
        },
      ],
      ...overrides,
    });
  },

  createPrivate(overrides?: Record<string, unknown>) {
    const id = nanoid(6);
    return this.createPayload({
      customer_type: "private",
      first_name: "Mario",
      last_name: `Rossi ${id}`,
      company_name: undefined,
      ...overrides,
    });
  },
};

/**
 * Factory for creating test addresses.
 */
export const AddressFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    return {
      address_type: "delivery",
      label: "Test Address",
      recipient_name: "Test Recipient",
      street_address: "Via Test 123",
      city: "Milano",
      province: "MI",
      postal_code: "20100",
      country: "IT",
      ...overrides,
    };
  },

  createBilling(overrides?: Record<string, unknown>) {
    return this.createPayload({
      address_type: "billing",
      label: "Billing Address",
      ...overrides,
    });
  },
};

/**
 * Factory for creating test portal users.
 */
export const PortalUserFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    const id = nanoid(6);
    return {
      username: `portal-user-${id}`,
      email: `portal-${id}@example.com`,
      password: "TestPassword123!",
      customer_access: [],
      ...overrides,
    };
  },

  createWithCustomerAccess(
    customerIds: string[],
    addressAccess: "all" | string[] = "all",
    overrides?: Record<string, unknown>
  ) {
    return this.createPayload({
      customer_access: customerIds.map((customer_id) => ({
        customer_id,
        address_access: addressAccess,
      })),
      ...overrides,
    });
  },
};

/**
 * Factory for creating test packaging options.
 */
export const PackagingOptionFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    const code = `PKG-${nanoid(4)}`;
    return {
      code,
      label: { it: `Test Package ${code}`, en: `Test Package ${code}` },
      qty: 1,
      uom: "PZ",
      is_default: false,
      is_smallest: false,
      is_sellable: true,
      position: 1,
      pricing: {
        list: 100,
        retail: 200,
      },
      ...overrides,
    };
  },

  createDefault(overrides?: Record<string, unknown>) {
    return this.createPayload({
      code: "PZ",
      label: { it: "Pezzo", en: "Piece" },
      qty: 1,
      is_default: true,
      is_smallest: true,
      ...overrides,
    });
  },

  createBox(overrides?: Record<string, unknown>) {
    return this.createPayload({
      code: "BOX",
      label: { it: "Scatola da 6", en: "Box of 6" },
      qty: 6,
      is_default: false,
      is_smallest: false,
      pricing: { list: 550, retail: 1100 },
      ...overrides,
    });
  },

  createNonSellable(overrides?: Record<string, unknown>) {
    return this.createPayload({
      code: "DISPLAY",
      label: { it: "Espositore", en: "Display" },
      qty: 24,
      is_sellable: false,
      ...overrides,
    });
  },
};

/**
 * Factory for creating test promotions.
 */
export const PromotionFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    const code = `PROMO-${nanoid(4)}`;
    return {
      promo_code: code,
      is_active: true,
      promo_type: "STD",
      label: { it: `Promo ${code}`, en: `Promo ${code}` },
      discount_percentage: 10,
      min_quantity: 1,
      is_stackable: false,
      priority: 1,
      ...overrides,
    };
  },

  createQuantityDiscount(overrides?: Record<string, unknown>) {
    return this.createPayload({
      promo_code: "QTY-DISC",
      label: { it: "Sconto Quantita", en: "Quantity Discount" },
      discount_percentage: 15,
      min_quantity: 5,
      ...overrides,
    });
  },
};

/**
 * Factory for creating test features (technical features for products).
 */
export const FeatureFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    const key = `feature-${nanoid(4)}`;
    return {
      feature_id: nanoid(12),
      key,
      label: `Test Feature ${key}`,
      type: "text",
      default_required: false,
      display_order: 0,
      is_active: true,
      ...overrides,
    };
  },

  createNumberFeature(overrides?: Record<string, unknown>) {
    return this.createPayload({
      key: "diameter",
      label: "Diameter",
      type: "number",
      uom_id: "mm-001",
      uom: { uom_id: "mm-001", symbol: "mm", name: "Millimeter", category: "length" },
      default_required: true,
      ...overrides,
    });
  },

  createSelectFeature(overrides?: Record<string, unknown>) {
    return this.createPayload({
      key: "material",
      label: "Material",
      type: "select",
      options: ["Steel", "Brass", "Plastic", "Copper"],
      default_required: true,
      ...overrides,
    });
  },

  createMultiselectFeature(overrides?: Record<string, unknown>) {
    return this.createPayload({
      key: "certifications",
      label: "Certifications",
      type: "multiselect",
      options: ["CE", "UL", "FDA", "ISO 9001"],
      default_required: false,
      ...overrides,
    });
  },

  createBooleanFeature(overrides?: Record<string, unknown>) {
    return this.createPayload({
      key: "fda_approved",
      label: "FDA Approved",
      type: "boolean",
      default_required: false,
      ...overrides,
    });
  },

  createInactive(overrides?: Record<string, unknown>) {
    return this.createPayload({
      is_active: false,
      ...overrides,
    });
  },
};

/**
 * Factory for creating test product types.
 */
export const ProductTypeFactory = {
  createPayload(overrides?: Record<string, unknown>) {
    const slug = `product-type-${nanoid(4)}`;
    return {
      product_type_id: nanoid(12),
      name: `Test Product Type ${slug}`,
      slug,
      description: `Description for ${slug}`,
      features: [],
      display_order: 0,
      is_active: true,
      product_count: 0,
      ...overrides,
    };
  },

  createWithFeatures(featureIds: string[], overrides?: Record<string, unknown>) {
    return this.createPayload({
      features: featureIds.map((feature_id, index) => ({
        feature_id,
        required: index === 0, // First feature is required
        display_order: index,
      })),
      ...overrides,
    });
  },

  createWaterMeter(featureIds?: string[], overrides?: Record<string, unknown>) {
    return this.createPayload({
      name: "Water Meter",
      slug: "water-meter",
      description: "Meters for measuring water flow and usage",
      features: featureIds?.map((feature_id, index) => ({
        feature_id,
        required: true,
        display_order: index,
      })) || [],
      display_order: 1,
      ...overrides,
    });
  },

  createValve(featureIds?: string[], overrides?: Record<string, unknown>) {
    return this.createPayload({
      name: "Valve",
      slug: "valve",
      description: "Valves for controlling flow",
      features: featureIds?.map((feature_id, index) => ({
        feature_id,
        required: index < 2, // First two are required
        display_order: index,
      })) || [],
      display_order: 2,
      ...overrides,
    });
  },

  createInactive(overrides?: Record<string, unknown>) {
    return this.createPayload({
      is_active: false,
      ...overrides,
    });
  },
};

// ============================================
// ASSERTIONS
// ============================================

/**
 * Assert API response is successful.
 */
export async function assertSuccess(
  response: Response,
  expectedStatus = 200
): Promise<Record<string, unknown>> {
  const data = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Error: ${data.error || "unknown"}`
    );
  }
  return data;
}

/**
 * Assert API response is an error.
 */
export async function assertError(
  response: Response,
  expectedStatus: number,
  expectedMessage?: string
): Promise<Record<string, unknown>> {
  const data = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }
  if (expectedMessage && !data.error?.includes(expectedMessage)) {
    throw new Error(`Expected error to contain "${expectedMessage}", got "${data.error}"`);
  }
  return data;
}
