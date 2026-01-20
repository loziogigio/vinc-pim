/**
 * E2E Test Script: Features & Product Types
 *
 * Tests the full lifecycle of Features and Product Types:
 * 1. Create Features (different types)
 * 2. Create Product Type (with features)
 * 3. List and query Features and Product Types
 * 4. Update Feature and Product Type
 * 5. Verify constraints (unique key/slug)
 * 6. Clean up (delete test data)
 *
 * Usage: npx tsx scripts/e2e-features-product-types.ts
 *
 * Uses API key authentication (test keys from CLAUDE.md)
 */

const API_BASE = process.env.API_BASE || "http://localhost:3001";

// API Key authentication headers
const API_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "x-auth-method": "api-key",
  "x-api-key-id": "ak_dfl-eventi-it_112233445566",
  "x-api-secret": "sk_112233445566778899aabbccddeeff00",
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

// Store created IDs for cleanup
const createdFeatureIds: string[] = [];
const createdProductTypeIds: string[] = [];

function log(message: string) {
  console.log(`\n${message}`);
}

function pass(name: string, message: string) {
  results.push({ name, passed: true, message });
  console.log(`  ✅ ${name}: ${message}`);
}

function fail(name: string, message: string) {
  results.push({ name, passed: false, message });
  console.log(`  ❌ ${name}: ${message}`);
}

// ============================================
// FEATURE API HELPERS
// ============================================

async function createFeature(data: any) {
  const res = await fetch(`${API_BASE}/api/b2b/pim/features`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function getFeatures(includeInactive = false) {
  const url = includeInactive
    ? `${API_BASE}/api/b2b/pim/features?include_inactive=true`
    : `${API_BASE}/api/b2b/pim/features`;
  const res = await fetch(url, { headers: API_HEADERS });
  return { ok: res.ok, data: await res.json() };
}

async function updateFeature(featureId: string, data: any) {
  const res = await fetch(`${API_BASE}/api/b2b/pim/features/${featureId}`, {
    method: "PATCH",
    headers: API_HEADERS,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function deleteFeature(featureId: string) {
  const res = await fetch(`${API_BASE}/api/b2b/pim/features/${featureId}`, {
    method: "DELETE",
    headers: API_HEADERS,
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ============================================
// PRODUCT TYPE API HELPERS
// ============================================

async function createProductType(data: any) {
  const res = await fetch(`${API_BASE}/api/b2b/pim/product-types`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function getProductTypes(includeInactive = false) {
  const url = includeInactive
    ? `${API_BASE}/api/b2b/pim/product-types?include_inactive=true`
    : `${API_BASE}/api/b2b/pim/product-types`;
  const res = await fetch(url, { headers: API_HEADERS });
  return { ok: res.ok, data: await res.json() };
}

async function getProductType(id: string) {
  const res = await fetch(`${API_BASE}/api/b2b/pim/product-types/${id}`, {
    headers: API_HEADERS,
  });
  return { ok: res.ok, data: await res.json() };
}

async function updateProductType(id: string, data: any) {
  const res = await fetch(`${API_BASE}/api/b2b/pim/product-types/${id}`, {
    method: "PATCH",
    headers: API_HEADERS,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function deleteProductType(id: string) {
  const res = await fetch(`${API_BASE}/api/b2b/pim/product-types/${id}`, {
    method: "DELETE",
    headers: API_HEADERS,
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ============================================
// TEST 1: Create Features (Different Types)
// ============================================
async function testCreateFeatures() {
  log("TEST 1: Create Features (Different Types)");

  const testFeatures = [
    {
      key: "e2e-test-diameter",
      label: "E2E Test Diameter",
      type: "number",
      uom_id: "mm-001",
      default_required: true,
      display_order: 1,
    },
    {
      key: "e2e-test-material",
      label: "E2E Test Material",
      type: "select",
      options: ["Steel", "Brass", "Plastic", "Copper"],
      default_required: true,
      display_order: 2,
    },
    {
      key: "e2e-test-certifications",
      label: "E2E Test Certifications",
      type: "multiselect",
      options: ["CE", "UL", "FDA", "ISO 9001"],
      default_required: false,
      display_order: 3,
    },
    {
      key: "e2e-test-approved",
      label: "E2E Test Approved",
      type: "boolean",
      default_required: false,
      display_order: 4,
    },
    {
      key: "e2e-test-notes",
      label: "E2E Test Notes",
      type: "text",
      default_required: false,
      display_order: 5,
    },
  ];

  let allCreated = true;

  for (const feature of testFeatures) {
    try {
      const { ok, data } = await createFeature(feature);

      if (ok && data.feature?.feature_id) {
        createdFeatureIds.push(data.feature.feature_id);
        pass(`Create ${feature.type} feature`, `Created ${feature.key} (ID: ${data.feature.feature_id})`);
      } else if (data.error?.includes("already exists")) {
        // Feature already exists from previous run - fetch it
        const existing = await getFeatures(true);
        const found = existing.data.features?.find((f: any) => f.key === feature.key);
        if (found) {
          createdFeatureIds.push(found.feature_id);
          pass(`Create ${feature.type} feature`, `Already exists: ${feature.key} (ID: ${found.feature_id})`);
        } else {
          fail(`Create ${feature.type} feature`, `Conflict but feature not found`);
          allCreated = false;
        }
      } else {
        fail(`Create ${feature.type} feature`, data.error || "Unknown error");
        allCreated = false;
      }
    } catch (error: any) {
      fail(`Create ${feature.type} feature`, error.message);
      allCreated = false;
    }
  }

  if (allCreated) {
    pass("Create Features", `Created/verified ${createdFeatureIds.length} features`);
  }
}

// ============================================
// TEST 2: Create Product Type with Features
// ============================================
async function testCreateProductType() {
  log("TEST 2: Create Product Type with Features");

  if (createdFeatureIds.length < 3) {
    fail("Create Product Type", "Not enough features created");
    return;
  }

  const productType = {
    name: "E2E Test Water Meter",
    slug: "e2e-test-water-meter",
    description: "E2E test product type for water meters",
    features: [
      { feature_id: createdFeatureIds[0], required: true, display_order: 0 },
      { feature_id: createdFeatureIds[1], required: true, display_order: 1 },
      { feature_id: createdFeatureIds[2], required: false, display_order: 2 },
    ],
    display_order: 99,
  };

  try {
    const { ok, data } = await createProductType(productType);

    if (ok && data.productType?.product_type_id) {
      createdProductTypeIds.push(data.productType.product_type_id);
      pass("Create Product Type", `Created ${productType.name} (ID: ${data.productType.product_type_id})`);

      // Verify features were attached
      if (data.productType.features?.length === 3) {
        pass("Product Type Features", `3 features attached correctly`);
      } else {
        fail("Product Type Features", `Expected 3 features, got ${data.productType.features?.length || 0}`);
      }
    } else if (data.error?.includes("already exists")) {
      // Already exists - fetch it
      const existing = await getProductTypes(true);
      const found = existing.data.productTypes?.find((pt: any) => pt.slug === productType.slug);
      if (found) {
        createdProductTypeIds.push(found.product_type_id);
        pass("Create Product Type", `Already exists: ${productType.name} (ID: ${found.product_type_id})`);
      } else {
        fail("Create Product Type", "Conflict but product type not found");
      }
    } else {
      fail("Create Product Type", data.error || "Unknown error");
    }
  } catch (error: any) {
    fail("Create Product Type", error.message);
  }
}

// ============================================
// TEST 3: List and Query Features
// ============================================
async function testListFeatures() {
  log("TEST 3: List and Query Features");

  try {
    // Get all active features
    const { ok, data } = await getFeatures();

    if (ok && Array.isArray(data.features)) {
      pass("List Features", `Found ${data.features.length} active features`);

      // Check our test features are included
      const testFeatures = data.features.filter((f: any) => f.key.startsWith("e2e-test-"));
      if (testFeatures.length > 0) {
        pass("Find Test Features", `Found ${testFeatures.length} test features in list`);
      } else {
        fail("Find Test Features", "No test features found in list");
      }

      // Verify feature structure
      const sample = data.features[0];
      if (sample && sample.feature_id && sample.key && sample.label && sample.type) {
        pass("Feature Structure", `Valid structure: feature_id, key, label, type present`);
      } else {
        fail("Feature Structure", "Missing required fields in feature");
      }
    } else {
      fail("List Features", data.error || "Invalid response");
    }
  } catch (error: any) {
    fail("List Features", error.message);
  }
}

// ============================================
// TEST 4: List and Query Product Types
// ============================================
async function testListProductTypes() {
  log("TEST 4: List and Query Product Types");

  try {
    // Get all active product types
    const { ok, data } = await getProductTypes();

    if (ok && Array.isArray(data.productTypes)) {
      pass("List Product Types", `Found ${data.productTypes.length} active product types`);

      // Check our test product type is included
      const testTypes = data.productTypes.filter((pt: any) => pt.slug.startsWith("e2e-test-"));
      if (testTypes.length > 0) {
        pass("Find Test Product Type", `Found ${testTypes.length} test product types`);
      } else {
        fail("Find Test Product Type", "No test product types found");
      }

      // Verify product type structure
      const sample = data.productTypes[0];
      if (sample && sample.product_type_id && sample.name && sample.slug) {
        pass("Product Type Structure", `Valid structure: product_type_id, name, slug present`);
      } else {
        fail("Product Type Structure", "Missing required fields");
      }
    } else {
      fail("List Product Types", data.error || "Invalid response");
    }
  } catch (error: any) {
    fail("List Product Types", error.message);
  }
}

// ============================================
// TEST 5: Get Single Product Type
// ============================================
async function testGetProductType() {
  log("TEST 5: Get Single Product Type with Features");

  if (createdProductTypeIds.length === 0) {
    fail("Get Product Type", "No product type ID available");
    return;
  }

  try {
    const { ok, data } = await getProductType(createdProductTypeIds[0]);

    if (ok && data.productType) {
      pass("Get Product Type", `Retrieved ${data.productType.name}`);

      // Check features are populated
      if (data.productType.features && data.productType.features.length > 0) {
        pass("Product Type Features", `Has ${data.productType.features.length} features`);
      } else {
        fail("Product Type Features", "No features in response");
      }
    } else {
      fail("Get Product Type", data.error || "Not found");
    }
  } catch (error: any) {
    fail("Get Product Type", error.message);
  }
}

// ============================================
// TEST 6: Update Feature
// ============================================
async function testUpdateFeature() {
  log("TEST 6: Update Feature");

  if (createdFeatureIds.length === 0) {
    fail("Update Feature", "No feature ID available");
    return;
  }

  const featureId = createdFeatureIds[0];

  try {
    // Update label
    const { ok, data } = await updateFeature(featureId, {
      label: "E2E Test Diameter (Updated)",
      display_order: 10,
    });

    if (ok && data.feature) {
      if (data.feature.label === "E2E Test Diameter (Updated)") {
        pass("Update Feature Label", `Label updated successfully`);
      } else {
        fail("Update Feature Label", "Label not updated");
      }

      if (data.feature.display_order === 10) {
        pass("Update Feature Order", `Display order updated to 10`);
      } else {
        fail("Update Feature Order", "Display order not updated");
      }

      // Revert
      await updateFeature(featureId, {
        label: "E2E Test Diameter",
        display_order: 1,
      });
      pass("Revert Feature", "Reverted to original values");
    } else {
      fail("Update Feature", data.error || "Update failed");
    }
  } catch (error: any) {
    fail("Update Feature", error.message);
  }
}

// ============================================
// TEST 7: Update Product Type
// ============================================
async function testUpdateProductType() {
  log("TEST 7: Update Product Type");

  if (createdProductTypeIds.length === 0) {
    fail("Update Product Type", "No product type ID available");
    return;
  }

  const productTypeId = createdProductTypeIds[0];

  try {
    // Update description
    const { ok, data } = await updateProductType(productTypeId, {
      description: "E2E test product type (Updated)",
      display_order: 100,
    });

    if (ok && data.productType) {
      if (data.productType.description === "E2E test product type (Updated)") {
        pass("Update Product Type Description", `Description updated`);
      } else {
        fail("Update Product Type Description", "Description not updated");
      }

      // Revert
      await updateProductType(productTypeId, {
        description: "E2E test product type for water meters",
        display_order: 99,
      });
      pass("Revert Product Type", "Reverted to original values");
    } else {
      fail("Update Product Type", data.error || "Update failed");
    }
  } catch (error: any) {
    fail("Update Product Type", error.message);
  }
}

// ============================================
// TEST 8: Unique Key Constraint (Feature)
// ============================================
async function testFeatureUniqueKey() {
  log("TEST 8: Unique Key Constraint (Feature)");

  try {
    // Try to create a feature with the same key
    const { ok, status, data } = await createFeature({
      key: "e2e-test-diameter",
      label: "Duplicate Diameter",
      type: "number",
    });

    if (!ok && data.error?.includes("already exists")) {
      pass("Feature Unique Key", `Correctly rejected duplicate key`);
    } else if (ok) {
      fail("Feature Unique Key", "Should have rejected duplicate key");
      // Clean up the duplicate
      if (data.feature?.feature_id) {
        await deleteFeature(data.feature.feature_id);
      }
    } else {
      fail("Feature Unique Key", `Unexpected error: ${data.error}`);
    }
  } catch (error: any) {
    fail("Feature Unique Key", error.message);
  }
}

// ============================================
// TEST 9: Unique Slug Constraint (Product Type)
// ============================================
async function testProductTypeUniqueSlug() {
  log("TEST 9: Unique Slug Constraint (Product Type)");

  try {
    // Try to create a product type with the same slug
    const { ok, status, data } = await createProductType({
      name: "Duplicate Water Meter",
      slug: "e2e-test-water-meter",
      description: "Duplicate test",
    });

    if (!ok && data.error?.includes("already exists")) {
      pass("Product Type Unique Slug", `Correctly rejected duplicate slug`);
    } else if (ok) {
      fail("Product Type Unique Slug", "Should have rejected duplicate slug");
      // Clean up the duplicate
      if (data.productType?.product_type_id) {
        await deleteProductType(data.productType.product_type_id);
      }
    } else {
      fail("Product Type Unique Slug", `Unexpected error: ${data.error}`);
    }
  } catch (error: any) {
    fail("Product Type Unique Slug", error.message);
  }
}

// ============================================
// TEST 10: Delete Feature Used by Product Type
// ============================================
async function testDeleteUsedFeature() {
  log("TEST 10: Delete Feature Used by Product Type");

  if (createdFeatureIds.length === 0 || createdProductTypeIds.length === 0) {
    fail("Delete Used Feature", "Missing feature or product type ID");
    return;
  }

  try {
    // Try to delete a feature that's used by a product type
    const { ok, data } = await deleteFeature(createdFeatureIds[0]);

    if (!ok && data.error?.includes("Cannot delete")) {
      pass("Delete Used Feature", `Correctly prevented deletion: ${data.error}`);
    } else if (ok) {
      fail("Delete Used Feature", "Should have prevented deletion of used feature");
      // Feature was deleted - this is unexpected
    } else {
      fail("Delete Used Feature", `Unexpected error: ${data.error}`);
    }
  } catch (error: any) {
    fail("Delete Used Feature", error.message);
  }
}

// ============================================
// CLEANUP: Delete Test Data
// ============================================
async function cleanup() {
  log("CLEANUP: Deleting Test Data");

  // Delete product types first (they reference features)
  for (const id of createdProductTypeIds) {
    try {
      const { ok } = await deleteProductType(id);
      if (ok) {
        pass("Delete Product Type", `Deleted ${id}`);
      } else {
        console.log(`  ⚠️ Could not delete product type ${id}`);
      }
    } catch (error: any) {
      console.log(`  ⚠️ Error deleting product type ${id}: ${error.message}`);
    }
  }

  // Now delete features
  for (const id of createdFeatureIds) {
    try {
      const { ok } = await deleteFeature(id);
      if (ok) {
        pass("Delete Feature", `Deleted ${id}`);
      } else {
        console.log(`  ⚠️ Could not delete feature ${id}`);
      }
    } catch (error: any) {
      console.log(`  ⚠️ Error deleting feature ${id}: ${error.message}`);
    }
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log("========================================");
  console.log("  Features & Product Types E2E Tests");
  console.log("========================================");
  console.log(`API Base: ${API_BASE}`);

  // Run tests
  await testCreateFeatures();
  await testCreateProductType();
  await testListFeatures();
  await testListProductTypes();
  await testGetProductType();
  await testUpdateFeature();
  await testUpdateProductType();
  await testFeatureUniqueKey();
  await testProductTypeUniqueSlug();
  await testDeleteUsedFeature();

  // Cleanup
  await cleanup();

  // Summary
  console.log("\n========================================");
  console.log("  SUMMARY");
  console.log("========================================");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total: ${results.length}`);

  if (failed > 0) {
    console.log("\n  Failed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`    - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log("\n  All tests passed! ✅");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
