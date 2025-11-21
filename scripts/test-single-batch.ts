/**
 * Test single batch import to debug batch_metadata
 */

const API_BASE = "http://localhost:3000";

async function testSingleBatch() {
  const products = [
    {
      entity_code: "TEST-001",
      sku: "TEST-001",
      name: "Test Product 1",
      description: "Test description",
      price: 29.99,
      currency: "EUR",
      stock_quantity: 100,
      status: "published",
    },
  ];

  const batch_id = `batch_test_${Date.now()}`;
  const batch_metadata = {
    batch_id,
    batch_part: 1,
    batch_total_parts: 1,
    batch_total_items: 1,
  };

  console.log("📦 Sending batch with metadata:");
  console.log(JSON.stringify({ batch_id, batch_metadata }, null, 2));

  const response = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products,
      source_id: "test-default-lang",
      batch_id,
      batch_metadata,
    }),
  });

  const result = await response.json();
  console.log("\n✅ Response:", JSON.stringify(result, null, 2));

  process.exit(0);
}

testSingleBatch();
