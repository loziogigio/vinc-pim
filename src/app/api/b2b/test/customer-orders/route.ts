import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { nanoid } from "nanoid";

/**
 * POST /api/b2b/test/customer-orders
 * Create test customers with multiple addresses and orders distributed across time periods
 * This tests the customer-order relationship, time-based stats, and address-based stats
 *
 * Body: {
 *   clear?: boolean,      // Clear existing test data first
 *   customers?: number,   // Number of customers to create (default: 5)
 *   ordersPerCustomer?: number // Orders per customer (default: 15)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Customer: CustomerModel, Order: OrderModel } = await connectWithModels(tenantDb);

    const body = await req.json().catch(() => ({}));
    const tenant_id = session.tenantId;
    const customerCount = body.customers || 5;
    const ordersPerCustomer = body.ordersPerCustomer || 15;

    // Always clear existing test data first to avoid duplicates
    await CustomerModel.deleteMany({ tenant_id, external_code: { $regex: /^TEST-/ } });
    await OrderModel.deleteMany({ tenant_id, customer_code: { $regex: /^TEST-/ } });

    // Also clear if explicitly requested (for all data)
    if (body.clear) {
      await CustomerModel.deleteMany({ tenant_id });
      await OrderModel.deleteMany({ tenant_id });
    }

    // Helpers
    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randomElement = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    const italianCities = [
      { city: "Milano", province: "MI", postal_code: "20100" },
      { city: "Roma", province: "RM", postal_code: "00100" },
      { city: "Torino", province: "TO", postal_code: "10100" },
      { city: "Napoli", province: "NA", postal_code: "80100" },
      { city: "Firenze", province: "FI", postal_code: "50100" },
    ];

    const companyNames = [
      "TechnoSystems Srl", "Global Trade SpA", "Innovation Hub", "Digital Works", "Smart Solutions",
      "Mega Industries", "Alpine Group", "Mediterranean Trading", "Euro Services", "Nordic Partners",
    ];

    const streetNames = ["Via Roma", "Via Milano", "Corso Italia", "Via Garibaldi", "Viale Europa"];

    const generateVatNumber = () => `IT${String(randomInt(10000000000, 99999999999))}`;
    const generateSdiCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return Array.from({ length: 7 }, () => chars[randomInt(0, chars.length - 1)]).join("");
    };

    // Products for orders
    const products = [
      { entity_code: "TEST-001", sku: "T-001", name: "Test Product Alpha", list_price: 50.00, unit_price: 40.00, vat_rate: 22 },
      { entity_code: "TEST-002", sku: "T-002", name: "Test Product Beta", list_price: 120.00, unit_price: 95.00, vat_rate: 22 },
      { entity_code: "TEST-003", sku: "T-003", name: "Test Product Gamma", list_price: 25.00, unit_price: 20.00, vat_rate: 10 },
      { entity_code: "TEST-004", sku: "T-004", name: "Test Product Delta", list_price: 200.00, unit_price: 160.00, vat_rate: 22 },
    ];

    const createLineItem = (product: typeof products[0], qty: number, lineNum: number) => {
      const line_gross = Math.round(qty * product.list_price * 100) / 100;
      const line_net = Math.round(qty * product.unit_price * 100) / 100;
      const line_vat = Math.round(line_net * (product.vat_rate / 100) * 100) / 100;
      const line_total = Math.round((line_net + line_vat) * 100) / 100;
      return {
        line_number: lineNum,
        entity_code: product.entity_code,
        sku: product.sku,
        name: product.name,
        quantity: qty,
        list_price: product.list_price,
        unit_price: product.unit_price,
        vat_rate: product.vat_rate,
        line_gross,
        line_net,
        line_vat,
        line_total,
        discounts: [],
        total_discount_percent: 0,
        is_gift_line: false,
        added_at: new Date(),
        updated_at: new Date(),
        added_from: "test",
        added_via: "api",
      };
    };

    const calcTotals = (items: ReturnType<typeof createLineItem>[]) => ({
      subtotal_gross: Math.round(items.reduce((s, i) => s + i.line_gross, 0) * 100) / 100,
      subtotal_net: Math.round(items.reduce((s, i) => s + i.line_net, 0) * 100) / 100,
      total_vat: Math.round(items.reduce((s, i) => s + i.line_vat, 0) * 100) / 100,
      total_discount: Math.round(items.reduce((s, i) => s + i.line_gross - i.line_net, 0) * 100) / 100,
      order_total: Math.round(items.reduce((s, i) => s + i.line_total, 0) * 100) / 100,
    });

    const createdCustomers = [];
    const createdOrders = [];
    const now = new Date();
    const year = now.getFullYear();

    // Create customers with multiple addresses
    for (let c = 0; c < customerCount; c++) {
      const companyName = companyNames[c % companyNames.length];
      const externalCode = `TEST-${String(c + 1).padStart(3, "0")}`;

      // Create 2-4 addresses per customer
      const addressCount = randomInt(2, 4);
      const addresses = [];

      for (let a = 0; a < addressCount; a++) {
        const location = italianCities[a % italianCities.length];
        const addressId = nanoid(8);
        addresses.push({
          address_id: addressId,
          address_type: a === 0 ? "both" : "delivery",
          label: a === 0 ? "Sede Principale" : `Filiale ${location.city}`,
          is_default: a === 0,
          recipient_name: companyName,
          street_address: `${randomElement(streetNames)} ${randomInt(1, 200)}`,
          city: location.city,
          province: location.province,
          postal_code: location.postal_code,
          country: "IT",
          phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      const customerId = nanoid(12);
      const customer = await CustomerModel.create({
        customer_id: customerId,
        external_code: externalCode,
        tenant_id,
        customer_type: "business",
        is_guest: false,
        email: `test${c + 1}@${companyName.toLowerCase().replace(/\s+/g, "")}.it`,
        phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
        company_name: companyName,
        legal_info: {
          vat_number: generateVatNumber(),
          pec_email: `${companyName.toLowerCase().replace(/\s+/g, "")}@pec.it`,
          sdi_code: generateSdiCode(),
        },
        addresses,
        default_shipping_address_id: addresses[0].address_id,
        default_billing_address_id: addresses[0].address_id,
      });

      // Track customer (order_count will be added after orders are created)
      const customerData = {
        customer_id: customerId,
        company_name: companyName,
        external_code: externalCode,
        address_count: addresses.length,
        address_ids: addresses.map(a => a.address_id),
        order_count: 0,
      };
      createdCustomers.push(customerData);

      // Create orders for this customer distributed across time and addresses
      // Vary the number of orders per customer (5-25 range based on customer index)
      const customerOrderCount = randomInt(5, 25);
      const statuses = ["draft", "pending", "confirmed", "shipped", "cancelled"];

      for (let o = 0; o < customerOrderCount; o++) {
        // Distribute orders across time periods:
        // - 40% in last 30 days
        // - 30% in 31-60 days
        // - 20% in 61-90 days
        // - 10% older than 90 days
        let daysAgo: number;
        const rand = Math.random();
        if (rand < 0.4) {
          daysAgo = randomInt(0, 29);
        } else if (rand < 0.7) {
          daysAgo = randomInt(30, 59);
        } else if (rand < 0.9) {
          daysAgo = randomInt(60, 89);
        } else {
          daysAgo = randomInt(90, 180);
        }

        const orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        // Distribute orders across addresses (weighted to first address)
        const addressIndex = Math.random() < 0.5 ? 0 : randomInt(0, addresses.length - 1);
        const shippingAddressId = addresses[addressIndex].address_id;

        // Create 1-3 line items
        const itemCount = randomInt(1, 3);
        const items = [];
        for (let i = 0; i < itemCount; i++) {
          const product = products[randomInt(0, products.length - 1)];
          const qty = randomInt(1, 10) * 5;
          items.push(createLineItem(product, qty, (i + 1) * 10));
        }

        const totals = calcTotals(items);
        const status = statuses[randomInt(0, statuses.length - 1)];

        const order = await OrderModel.create({
          order_id: nanoid(12),
          year,
          status,
          order_number: status === "confirmed" || status === "shipped" ? randomInt(1000, 9999) : undefined,
          tenant_id,
          customer_id: customerId,
          customer_code: externalCode,
          shipping_address_id: shippingAddressId,
          price_list_id: "default",
          price_list_type: "wholesale",
          order_type: "b2b",
          currency: "EUR",
          ...totals,
          shipping_cost: 0,
          po_reference: status !== "draft" ? `PO-TEST-${randomInt(1000, 9999)}` : undefined,
          session_id: `sess_${nanoid(16)}`,
          flow_id: `flow_${nanoid(16)}`,
          source: "api",
          channel: "api",
          items,
          created_at: orderDate,
          updated_at: orderDate,
        });

        createdOrders.push({
          order_id: order.order_id,
          customer_id: customerId,
          status,
          total: order.order_total,
          shipping_address_id: shippingAddressId,
          days_ago: daysAgo,
        });
      }

      // Update the customer's order count
      customerData.order_count = customerOrderCount;
    }

    // Calculate summary stats
    const orderStats = {
      total: createdOrders.length,
      by_status: {
        draft: createdOrders.filter(o => o.status === "draft").length,
        pending: createdOrders.filter(o => o.status === "pending").length,
        confirmed: createdOrders.filter(o => o.status === "confirmed").length,
        shipped: createdOrders.filter(o => o.status === "shipped").length,
        cancelled: createdOrders.filter(o => o.status === "cancelled").length,
      },
      by_time_period: {
        last_30_days: createdOrders.filter(o => o.days_ago < 30).length,
        "31_60_days": createdOrders.filter(o => o.days_ago >= 30 && o.days_ago < 60).length,
        "61_90_days": createdOrders.filter(o => o.days_ago >= 60 && o.days_ago < 90).length,
        older_than_90: createdOrders.filter(o => o.days_ago >= 90).length,
      },
    };

    return NextResponse.json({
      success: true,
      message: `Created ${createdCustomers.length} customers with ${createdOrders.length} orders`,
      tenant_id,
      customers: createdCustomers,
      order_stats: orderStats,
      test_urls: createdCustomers.map(c => ({
        customer_id: c.customer_id,
        dashboard_url: `/b2b/customers/${c.customer_id}`,
        api_url: `/api/b2b/customers/${c.customer_id}`,
      })),
    });
  } catch (error) {
    console.error("Error creating test customer-orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/test/customer-orders
 * Remove test data
 * Query params:
 *   - all=true: Delete ALL customers and orders (not just TEST- prefixed)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Customer: CustomerModel, Order: OrderModel } = await connectWithModels(tenantDb);

    const tenant_id = session.tenantId;
    const deleteAll = req.nextUrl.searchParams.get("all") === "true";

    let deletedCustomers;
    let deletedOrders;

    if (deleteAll) {
      // Delete ALL customers and orders
      deletedCustomers = await CustomerModel.deleteMany({ tenant_id });
      deletedOrders = await OrderModel.deleteMany({ tenant_id });
    } else {
      // Only delete TEST- prefixed data
      deletedCustomers = await CustomerModel.deleteMany({
        tenant_id,
        external_code: { $regex: /^TEST-/ }
      });
      deletedOrders = await OrderModel.deleteMany({
        tenant_id,
        customer_code: { $regex: /^TEST-/ }
      });
    }

    return NextResponse.json({
      success: true,
      message: deleteAll ? "All data deleted" : "Test data deleted",
      deleted: {
        customers: deletedCustomers.deletedCount,
        orders: deletedOrders.deletedCount,
      },
    });
  } catch (error) {
    console.error("Error deleting test data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
