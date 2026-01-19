/**
 * Test Script: Add Product with All Packaging Options
 *
 * Adds TEST-PKG-001 with all 3 packaging options to an order:
 * - PZ (Pezzo): 1 unit, smallest
 * - BOX (Scatola da 6): 6 units, default
 * - CF (Cartone da 24): 24 units
 */

import "dotenv/config";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";
const API_KEY_ID = process.env.TEST_API_KEY_ID || "ak_dfl-eventi-it_112233445566";
const API_SECRET = process.env.TEST_API_SECRET || "sk_112233445566778899aabbccddeeff00";

const headers = {
  "Content-Type": "application/json",
  "x-auth-method": "api-key",
  "x-api-key-id": API_KEY_ID,
  "x-api-secret": API_SECRET,
};

interface Promotion {
  promo_code?: string;
  promo_row?: number;
  label?: { it?: string } | string;
  discount_percentage?: number;
  discount_amount?: number;
  is_active?: boolean;
}

interface PackagingOption {
  code: string;
  label?: { it?: string } | string;
  qty: number;
  uom: string;
  is_default?: boolean;
  is_smallest?: boolean;
  pricing?: {
    list?: number;
    retail?: number;
    sale?: number;
  };
  promotions?: Promotion[];
}

async function main() {
  console.log("=== ADD ALL PACKAGING OPTIONS TEST ===\n");

  // Step 1: Fetch product details
  console.log("STEP 1: Fetch Product Info");
  const productCode = "TEST-PKG-001";

  const productRes = await fetch(`${API_BASE}/api/b2b/pim/products/${productCode}`, { headers });
  const productData = await productRes.json();
  const product = productData.product;

  if (!product) {
    console.error("  Product not found:", productData);
    process.exit(1);
  }

  console.log("  Product:", product.entity_code);
  console.log("  Name:", product.name?.it || product.name);

  const packagingOptions: PackagingOption[] = product.packaging_options || [];
  console.log("  Packaging options:", packagingOptions.length);

  if (packagingOptions.length === 0) {
    console.error("  No packaging options found!");
    process.exit(1);
  }

  // Display packaging options
  console.log("\n  Available Packaging Options:");
  for (const pkg of packagingOptions) {
    const label = typeof pkg.label === "string" ? pkg.label : pkg.label?.it || pkg.code;
    const flags = [
      pkg.is_default ? "Default" : "",
      pkg.is_smallest ? "Smallest" : "",
    ].filter(Boolean).join(", ");
    console.log(`    - ${pkg.code}: ${label} (${pkg.qty} ${pkg.uom}) ${flags ? `[${flags}]` : ""}`);
    console.log(`      List: €${pkg.pricing?.list || "N/A"}, Sale: €${pkg.pricing?.sale || "N/A"}`);
  }

  // Step 2: Get a customer to create order for
  console.log("\nSTEP 2: Get Customer");
  const customersRes = await fetch(`${API_BASE}/api/b2b/customers?limit=1`, { headers });
  const customersData = await customersRes.json();

  if (!customersData.customers?.length) {
    console.error("  No customers found!");
    process.exit(1);
  }

  const customer = customersData.customers[0];
  console.log("  Customer:", customer.customer_id);
  console.log("  Company:", customer.company_name);

  // Step 3: Create a new order
  console.log("\nSTEP 3: Create Order");
  const orderRes = await fetch(`${API_BASE}/api/b2b/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer_id: customer.customer_id,
      order_type: "b2b",
      price_list_type: "wholesale",
      currency: "EUR",
      notes: "Test order with all packaging options",
    }),
  });
  const orderData = await orderRes.json();

  if (!orderRes.ok) {
    console.error("  Failed to create order:", orderData);
    process.exit(1);
  }

  console.log("  Order created:", orderData.order?.order_id);

  // Step 4: Add items with each packaging option
  console.log("\nSTEP 4: Add Items with All Packaging Options");

  for (const pkg of packagingOptions) {
    const label = typeof pkg.label === "string" ? pkg.label : pkg.label?.it || pkg.code;
    const pricing = pkg.pricing || {};

    // Calculate quantity (2x the pack size to test ordering multiple packs)
    const quantity = pkg.qty * 2;

    // Determine prices
    const listPrice = pricing.list ?? product.price ?? 50;
    const unitPrice = pricing.sale ?? pricing.list ?? product.price ?? 50;

    // Check for active promotions
    const activePromo = pkg.promotions?.find((p: Promotion) => p.is_active);
    const promoLabel = activePromo?.label
      ? typeof activePromo.label === "string"
        ? activePromo.label
        : activePromo.label?.it
      : undefined;

    // Get retail price if available (moved up for logging)
    const retailPrice = pricing.retail ?? product.retail_price;

    console.log(`\n  Adding ${pkg.code} (${label}):`);
    console.log(`    Qty: ${quantity} (${quantity / pkg.qty} packs × ${pkg.qty})`);
    console.log(`    Retail: €${retailPrice || "N/A"}, List: €${listPrice}, Unit: €${unitPrice}`);
    if (activePromo) {
      console.log(`    Promo: ${activePromo.promo_code} - ${promoLabel || "N/A"}`);
      if (activePromo.discount_percentage) console.log(`      Discount: ${activePromo.discount_percentage}%`);
      if (activePromo.discount_amount) console.log(`      Discount: €${activePromo.discount_amount}`);
    }

    const addItemRes = await fetch(
      `${API_BASE}/api/b2b/orders/${orderData.order.order_id}/items`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          entity_code: product.entity_code,
          sku: product.sku || product.entity_code,
          quantity,
          list_price: listPrice,
          retail_price: retailPrice, // MSRP
          unit_price: unitPrice,
          vat_rate: product.vat_rate || 22,
          name: product.name?.it || product.name || "Test Product",
          pack_size: pkg.qty,
          quantity_unit: pkg.uom,
          packaging_code: pkg.code,
          packaging_label: label,
          product_source: "pim",
          // Promotion info
          ...(activePromo && {
            promo_code: activePromo.promo_code,
            promo_row: activePromo.promo_row,
            promo_label: promoLabel,
            promo_discount_pct: activePromo.discount_percentage,
            promo_discount_amt: activePromo.discount_amount,
          }),
        }),
      }
    );

    const itemData = await addItemRes.json();

    if (!addItemRes.ok) {
      console.error(`    FAILED:`, itemData.error);
    } else {
      console.log(`    SUCCESS: Line #${itemData.item?.line_number}`);
      console.log(`    Line total: €${itemData.item?.line_total?.toFixed(2)}`);
      if (itemData.item?.promo_code) {
        console.log(`    Promo applied: ${itemData.item.promo_code}`);
      }
    }
  }

  // Step 5: Fetch order summary
  console.log("\n\nSTEP 5: Order Summary");
  const finalOrderRes = await fetch(`${API_BASE}/api/b2b/orders/${orderData.order.order_id}`, { headers });
  const finalOrderData = await finalOrderRes.json();
  const finalOrder = finalOrderData.order;

  console.log(`  Order ID: ${finalOrder.order_id}`);
  console.log(`  Status: ${finalOrder.status}`);
  console.log(`  Items: ${finalOrder.items?.length || 0}`);
  console.log("\n  Line Items:");

  for (const item of finalOrder.items || []) {
    console.log(`    - ${item.packaging_code || "N/A"} (${item.packaging_label || "Unit"})`);
    console.log(`      Qty: ${item.quantity}, Pack: ${item.pack_size || 1}`);
    // Show pricing with retail if available
    const priceInfo = item.retail_price
      ? `Retail: €${item.retail_price}, Unit: €${item.unit_price}`
      : `Unit: €${item.unit_price}`;
    console.log(`      ${priceInfo}, Total: €${item.line_total?.toFixed(2)}`);
    // Show discount if applicable
    if (item.retail_price && item.retail_price > item.unit_price) {
      const discountPct = Math.round((1 - item.unit_price / item.retail_price) * 100);
      console.log(`      Discount: ${discountPct}% off retail`);
    }
  }

  console.log("\n  Order Totals:");
  console.log(`    Subtotal (Gross): €${finalOrder.subtotal_gross?.toFixed(2)}`);
  console.log(`    Subtotal (Net):   €${finalOrder.subtotal_net?.toFixed(2)}`);
  console.log(`    VAT:              €${finalOrder.total_vat?.toFixed(2)}`);
  console.log(`    TOTAL:            €${finalOrder.order_total?.toFixed(2)}`);

  console.log("\n=== TEST COMPLETED ===");
  console.log(`View order: ${API_BASE.replace("localhost:3001", "localhost:3001")}/dfl-eventi-it/b2b/store/orders/${finalOrder.order_id}`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
