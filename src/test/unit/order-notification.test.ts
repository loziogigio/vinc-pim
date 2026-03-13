/**
 * Unit Tests: Order Notification Trigger System
 *
 * Tests the trigger dispatch and order notification services.
 * Verifies variable building, recipient resolution, payload construction,
 * and the fire-and-forget dispatch pattern.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCKS
// ============================================

const { mockCustomerModel, mockHomeSettingsModel, mockTenantPaymentConfigModel } = vi.hoisted(() => ({
  mockCustomerModel: {
    findOne: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn(),
      }),
    }),
  },
  mockHomeSettingsModel: {
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn(),
    }),
  },
  mockTenantPaymentConfigModel: {
    findOne: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    }),
  },
}));

const mockSendNotification = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn().mockResolvedValue({
    Customer: mockCustomerModel,
    HomeSettings: mockHomeSettingsModel,
    TenantPaymentConfig: mockTenantPaymentConfigModel,
  }),
}));

vi.mock("@/lib/notifications/send.service", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

vi.mock("@/lib/notifications/company-info", () => ({
  getCompanyInfo: vi.fn().mockResolvedValue({
    company_name: "Test Company",
    logo: "",
    address: "Via Roma 1, Milano",
    phone: "+39 02 1234567",
    email: "info@test.com",
    contact_info: "",
    business_hours: "",
    primary_color: "#009f7f",
    shop_name: "Test Shop",
    shop_url: "https://shop.test.com",
    current_year: "2026",
    vat_number: "IT12345678901",
    footer_text: "",
  }),
  companyInfoToRecord: vi.fn().mockReturnValue({
    company_name: "Test Company",
    shop_name: "Test Shop",
    shop_url: "https://shop.test.com",
    primary_color: "#009f7f",
    email: "info@test.com",
    phone: "+39 02 1234567",
    address: "Via Roma 1, Milano",
    logo: "",
    contact_info: "",
    business_hours: "",
    current_year: "2026",
    vat_number: "IT12345678901",
    footer_text: "",
  }),
}));

// Import after mocks
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import { dispatchOrderNotification } from "@/lib/notifications/order-notification.service";
import type { IOrder } from "@/lib/db/models/order";

// ============================================
// TEST FIXTURES
// ============================================

function createMockOrder(overrides?: Partial<IOrder>): IOrder {
  return {
    order_id: "abc123def456",
    order_number: 42,
    cart_number: 10,
    year: 2026,
    status: "pending",
    is_current: false,
    tenant_id: "test-tenant",
    customer_id: "cust_001",
    customer_code: "C-001",
    items: [
      {
        line_number: 10,
        entity_code: "PROD-A",
        sku: "SKU-A-001",
        name: "Widget Alpha",
        quantity: 5,
        unit_price: 25.0,
        list_price: 30.0,
        vat_rate: 22,
        line_gross: 150.0,
        line_net: 125.0,
        line_vat: 27.5,
        line_total: 152.5,
        image_url: "https://cdn.test.com/widget-a.jpg",
      },
    ],
    subtotal_gross: 150.0,
    subtotal_net: 125.0,
    total_discount: 25.0,
    total_vat: 27.5,
    shipping_cost: 10.0,
    order_total: 162.5,
    currency: "EUR",
    submitted_at: new Date("2026-03-01T10:00:00Z"),
    shipping_snapshot: {
      recipient_name: "Mario Rossi",
      street_address: "Via Roma 123",
      city: "Milano",
      province: "MI",
      postal_code: "20100",
      country: "IT",
    },
    billing_snapshot: {
      recipient_name: "Rossi S.r.l.",
      street_address: "Via Torino 50",
      city: "Milano",
      province: "MI",
      postal_code: "20100",
      country: "IT",
    },
    delivery: {
      carrier: "BRT",
      tracking_number: "BRT123456789",
      tracking_url: "https://track.brt.it/BRT123456789",
      estimated_delivery: new Date("2026-03-05"),
    },
    payment: {
      payment_status: "awaiting",
      amount_due: 162.5,
      amount_paid: 0,
      amount_remaining: 162.5,
      payments: [],
    },
    cancellation_reason: undefined,
    ...overrides,
  } as unknown as IOrder;
}

// ============================================
// TESTS
// ============================================

describe("unit: Order Notification Trigger System", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: B2B customer found
    mockCustomerModel.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          email: "mario@company.it",
          first_name: "Mario",
          last_name: "Rossi",
          company_name: "Rossi S.r.l.",
        }),
      }),
    });

    // Default: HomeSettings with SMTP
    mockHomeSettingsModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        branding: { title: "Test Shop", primaryColor: "#009f7f" },
        company_info: { email: "info@test.com" },
        smtp_settings: { from: "noreply@test.com" },
      }),
    });
  });

  // ============================================
  // dispatchTrigger (generic dispatcher)
  // ============================================

  describe("dispatchTrigger", () => {
    it("should dispatch order_confirmation trigger", async () => {
      const order = createMockOrder();

      await dispatchTrigger("vinc-test-tenant", "order_confirmation", {
        type: "order",
        order,
        portalUserId: "user_123",
      });

      expect(mockSendNotification).toHaveBeenCalledOnce();
      const call = mockSendNotification.mock.calls[0][0];
      expect(call.tenantDb).toBe("vinc-test-tenant");
      expect(call.trigger).toBe("order_confirmation");
      expect(call.to).toBe("mario@company.it");
      expect(call.targetUserId).toBe("user_123");
    });

    it("should dispatch payment trigger with payment data", async () => {
      const order = createMockOrder();

      await dispatchTrigger("vinc-test-tenant", "payment_received", {
        type: "payment",
        order,
        paymentAmount: 100.0,
        paymentMethod: "bank_transfer",
      });

      expect(mockSendNotification).toHaveBeenCalledOnce();
      const call = mockSendNotification.mock.calls[0][0];
      expect(call.trigger).toBe("payment_received");
      expect(call.variables.payment_method).toBe("bank_transfer");
    });

    it("should not throw on error (fire-and-forget)", async () => {
      mockSendNotification.mockRejectedValueOnce(new Error("SMTP down"));
      const order = createMockOrder();

      // Should not throw
      await expect(
        dispatchTrigger("vinc-test-tenant", "order_confirmation", {
          type: "order",
          order,
        })
      ).resolves.toBeUndefined();
    });
  });

  // ============================================
  // dispatchOrderNotification
  // ============================================

  describe("dispatchOrderNotification", () => {
    it("should skip notification when no recipient email found", async () => {
      // No buyer, no customer
      const order = createMockOrder({ customer_id: undefined, buyer: undefined });
      mockCustomerModel.findOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      });

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("should use buyer email for B2C guest orders", async () => {
      const order = createMockOrder({
        customer_id: undefined,
        buyer: {
          email: "guest@example.com",
          first_name: "Luca",
          last_name: "Bianchi",
          customer_type: "private",
        },
      });

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      expect(mockSendNotification).toHaveBeenCalledOnce();
      const call = mockSendNotification.mock.calls[0][0];
      expect(call.to).toBe("guest@example.com");
      expect(call.variables.customer_name).toBe("Luca Bianchi");
    });

    it("should look up customer email for B2B orders", async () => {
      const order = createMockOrder();

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      expect(mockCustomerModel.findOne).toHaveBeenCalledWith({ customer_id: "cust_001" });
      const call = mockSendNotification.mock.calls[0][0];
      expect(call.to).toBe("mario@company.it");
      expect(call.variables.customer_name).toBe("Mario Rossi");
    });

    it("should build correct variables for order_confirmation", async () => {
      const order = createMockOrder();

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.order_number).toBe("OR/42/2026");
      expect(vars.order_total).toContain("162");
      expect(vars.shipping_address).toContain("Via Roma 123");
      expect(vars.shipping_address).toContain("Milano");
      expect(vars.billing_address).toContain("Via Torino 50");
      expect(vars.subtotal_net).toContain("125");
      expect(vars.total_vat).toContain("27");
      expect(vars.items_count).toBe("1");
      expect(vars.order_items_html).toContain("Widget Alpha");
      expect(vars.order_items_html).toContain("SKU-A-001");
      expect(vars.shop_name).toBe("Test Shop");
    });

    it("should include bank transfer info when payment is bank_transfer", async () => {
      mockTenantPaymentConfigModel.findOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            providers: {
              bank_transfer_provider: {
                beneficiary_name: "Rossi S.r.l.",
                iban: "IT60X0542811101000000123456",
                bic_swift: "BPPIITRRXXX",
                bank_name: "Intesa Sanpaolo",
                enabled: true,
              },
            },
          }),
        }),
      });

      const order = createMockOrder({
        payment: {
          payment_status: "awaiting",
          payment_method: "bank_transfer",
          amount_due: 162.5,
          amount_paid: 0,
          amount_remaining: 162.5,
          payments: [],
        },
      });

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.payment_method).toBe("Bonifico Bancario");
      expect(vars.bank_iban).toBe("IT60X0542811101000000123456");
      expect(vars.bank_beneficiary).toBe("Rossi S.r.l.");
      expect(vars.bank_bic_swift).toBe("BPPIITRRXXX");
      expect(vars.bank_name).toBe("Intesa Sanpaolo");
      expect(vars.bank_causale).toBe("Ordine OR/42/2026");
    });

    it("should leave bank fields empty when payment is not bank_transfer", async () => {
      const order = createMockOrder({
        payment: {
          payment_status: "paid",
          payment_method: "credit_card",
          amount_due: 0,
          amount_paid: 162.5,
          amount_remaining: 0,
          payments: [],
        },
      });

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.payment_method).toBe("Carta di Credito");
      expect(vars.bank_iban).toBe("");
      expect(vars.bank_beneficiary).toBe("");
    });

    it("should build correct variables for order_shipped", async () => {
      const order = createMockOrder({ status: "shipped" });

      await dispatchOrderNotification("vinc-test", "order_shipped", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.tracking_number).toBe("BRT123456789");
      expect(vars.carrier_name).toBe("BRT");
      expect(vars.tracking_url).toBe("https://track.brt.it/BRT123456789");
    });

    it("should build correct variables for order_cancelled", async () => {
      const order = createMockOrder({
        status: "cancelled",
        cancellation_reason: "Richiesta dal cliente",
      });

      await dispatchOrderNotification("vinc-test", "order_cancelled", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.cancel_reason).toBe("Richiesta dal cliente");
      expect(vars.support_email).toBe("info@test.com");
    });

    it("should build correct variables for payment_received", async () => {
      const order = createMockOrder();

      await dispatchOrderNotification("vinc-test", "payment_received", order, {
        paymentAmount: 100.0,
        paymentMethod: "carta_credito",
      });

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.payment_method).toBe("carta_credito");
      expect(vars.payment_amount).toContain("100");
    });

    it("should include OrderPayload for in-app/mobile", async () => {
      const order = createMockOrder();

      await dispatchOrderNotification("vinc-test", "order_shipped", order);

      const call = mockSendNotification.mock.calls[0][0];
      expect(call.payload).toBeDefined();
      expect(call.payload.category).toBe("order");
      expect(call.payload.order.id).toBe("abc123def456");
      expect(call.payload.order.number).toBe("OR/42/2026");
      expect(call.payload.order.carrier).toBe("BRT");
      expect(call.payload.order.tracking_code).toBe("BRT123456789");
      expect(call.payload.order.items).toHaveLength(1);
      expect(call.payload.order.items[0].sku).toBe("SKU-A-001");
    });

    it("should use immediate=false for async email delivery", async () => {
      const order = createMockOrder();

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      const call = mockSendNotification.mock.calls[0][0];
      expect(call.immediate).toBe(false);
    });

    it("should handle missing delivery data gracefully", async () => {
      const order = createMockOrder({ delivery: undefined });

      await dispatchOrderNotification("vinc-test", "order_shipped", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.tracking_number).toBe("N/A");
      expect(vars.carrier_name).toBe("N/A");
      expect(vars.estimated_delivery).toBe("Da confermare");
    });

    it("should handle missing shipping snapshot gracefully", async () => {
      const order = createMockOrder({ shipping_snapshot: undefined });

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.shipping_address).toBe("");
    });

    it("should fall back to 'Cliente' when no name is found", async () => {
      const order = createMockOrder({ customer_id: "unknown", buyer: undefined });
      mockCustomerModel.findOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ email: "no-name@test.com" }),
        }),
      });

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.customer_name).toBe("Cliente");
    });

    it("should use order_id prefix when order_number is missing", async () => {
      const order = createMockOrder({ order_number: undefined });

      await dispatchOrderNotification("vinc-test", "order_confirmation", order);

      const vars = mockSendNotification.mock.calls[0][0].variables;
      expect(vars.order_number).toBe("abc123de");
    });
  });
});

// ============================================
// TRIGGER_CATEGORY_MAP completeness
// ============================================

describe("unit: TRIGGER_CATEGORY_MAP completeness", () => {
  it("should map all notification triggers to a category", async () => {
    const { NOTIFICATION_TRIGGERS } = await import("@/lib/constants/notification");
    const { TRIGGER_CATEGORY_MAP } = await import("@/lib/types/notification-payload");

    for (const trigger of NOTIFICATION_TRIGGERS) {
      expect(
        TRIGGER_CATEGORY_MAP[trigger],
        `Missing category mapping for trigger: ${trigger}`
      ).toBeDefined();
    }
  });
});
