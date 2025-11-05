/**
 * Test Brands API
 *
 * Simple script to test the brands API endpoints
 *
 * Usage: node scripts/test-brands-api.cjs
 */

require("dotenv").config({ path: ".env.local" });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function testBrandsAPI() {
  console.log("🧪 Testing Brands API\n");
  console.log(`API Base URL: ${API_BASE}\n`);

  try {
    // Test 1: List all brands
    console.log("📋 Test 1: GET /api/b2b/pim/brands");
    const listResponse = await fetch(`${API_BASE}/api/b2b/pim/brands`);

    if (!listResponse.ok) {
      console.log(
        `   ⚠️  Response status: ${listResponse.status} ${listResponse.statusText}`
      );
      if (listResponse.status === 401) {
        console.log(
          "   ℹ️  Unauthorized - This is expected if not authenticated"
        );
        console.log(
          "   ℹ️  Please test the API through the browser while logged in"
        );
        return;
      }
    } else {
      const data = await listResponse.json();
      console.log(`   ✅ Success! Found ${data.brands?.length || 0} brands`);
      if (data.brands && data.brands.length > 0) {
        console.log(`   📦 First brand: ${data.brands[0].label}`);
      }
    }

    console.log("\n---\n");

    // Test 2: Search brands
    console.log('📋 Test 2: GET /api/b2b/pim/brands?search="vaillant"');
    const searchResponse = await fetch(
      `${API_BASE}/api/b2b/pim/brands?search=vaillant`
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      console.log(`   ✅ Success! Found ${data.brands?.length || 0} brands`);
      if (data.brands && data.brands.length > 0) {
        console.log(`   📦 Brands: ${data.brands.map((b) => b.label).join(", ")}`);
      }
    }

    console.log("\n---\n");

    // Test 3: Filter active brands
    console.log("📋 Test 3: GET /api/b2b/pim/brands?is_active=true");
    const activeResponse = await fetch(
      `${API_BASE}/api/b2b/pim/brands?is_active=true`
    );

    if (activeResponse.ok) {
      const data = await activeResponse.json();
      console.log(
        `   ✅ Success! Found ${data.brands?.length || 0} active brands`
      );
    }

    console.log("\n---\n");

    console.log("✨ API tests completed!");
    console.log(
      "\nℹ️  Note: Full testing requires authentication. Please test through the browser UI."
    );
    console.log("   Navigate to: http://localhost:3001/b2b/pim/brands\n");
  } catch (error) {
    console.error("❌ Error testing API:", error.message);
    console.log(
      "\nℹ️  Make sure the development server is running: pnpm dev\n"
    );
  }
}

// Run tests
testBrandsAPI();
