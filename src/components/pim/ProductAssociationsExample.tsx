"use client";

/**
 * EXAMPLE: How to use Product Association Components
 *
 * This file demonstrates how to integrate all product association components:
 * 1. ProductTypeSelector - Select a product type
 * 2. CollectionsSelector - Select multiple collections
 * 3. CategorySelector - Select a category
 * 4. FeaturesForm - Edit technical feature values (populated from product type)
 *
 * Usage in your product form:
 * - Import these components
 * - Manage state for product_type, collections, category, and feature values
 * - Pass them to the PATCH API when saving
 */

import { useState } from "react";
import { ProductTypeSelector } from "./ProductTypeSelector";
import { CollectionsSelector } from "./CollectionsSelector";
import { CategorySelector } from "./CategorySelector";
import { FeaturesForm } from "./FeaturesForm";

type ProductTypeWithFeatures = {
  product_type_id: string;
  name: string;
  slug: string;
  featureDetails?: {
    feature_id: string;
    key: string;
    label: string;
    type: "text" | "number" | "select" | "multiselect" | "boolean";
    unit?: string;
    options?: string[];
    required: boolean;
  }[];
};

export function ProductAssociationsExample() {
  // State for product associations
  const [productType, setProductType] = useState<ProductTypeWithFeatures | null>(null);
  const [collections, setCollections] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [category, setCategory] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [featureValues, setFeatureValues] = useState<any[]>([]);

  // When saving, you would send this data structure:
  const getPayloadForAPI = () => {
    return {
      // Other product fields...

      // Product Type
      product_type: productType ? {
        id: productType.product_type_id,
        name: productType.name,
        slug: productType.slug,
        technical_features: featureValues, // Feature values entered by user
      } : null,

      // Collections
      collections: collections,

      // Category
      category: category,
    };
  };

  // Example of how to handle save
  async function handleSave() {
    const payload = getPayloadForAPI();

    const res = await fetch("/api/b2b/pim/products/PRODUCT_ENTITY_CODE", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log("Product updated successfully!");
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Product Associations</h2>

      {/* Product Type Selector */}
      <div className="rounded-lg border border-border p-6">
        <ProductTypeSelector
          value={productType ? {
            id: productType.product_type_id,
            name: productType.name,
            slug: productType.slug,
          } : undefined}
          onChange={(selectedType) => {
            setProductType(selectedType);
            // Clear feature values when product type changes
            if (!selectedType) {
              setFeatureValues([]);
            }
          }}
        />
      </div>

      {/* Category Selector */}
      <div className="rounded-lg border border-border p-6">
        <CategorySelector
          value={category || undefined}
          onChange={setCategory}
        />
      </div>

      {/* Collections Selector */}
      <div className="rounded-lg border border-border p-6">
        <CollectionsSelector
          value={collections}
          onChange={setCollections}
        />
      </div>

      {/* Features Form - Only shown when product type is selected */}
      {productType && productType.featureDetails && (
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Features</h3>
          <FeaturesForm
            features={productType.featureDetails}
            values={featureValues}
            onChange={setFeatureValues}
          />
        </div>
      )}

      {/* Preview of what will be saved */}
      <div className="rounded-lg border border-border p-6 bg-muted/30">
        <h3 className="text-lg font-semibold mb-4">Preview (JSON to send to API)</h3>
        <pre className="text-xs bg-background p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(getPayloadForAPI(), null, 2)}
        </pre>
      </div>

      {/* Save button example */}
      <button
        onClick={handleSave}
        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
      >
        Save Product
      </button>
    </div>
  );
}

/**
 * INTEGRATION GUIDE FOR EXISTING PRODUCT FORM
 * ============================================
 *
 * 1. Import the components:
 *    import { ProductTypeSelector } from "@/components/pim/ProductTypeSelector";
 *    import { CollectionsSelector } from "@/components/pim/CollectionsSelector";
 *    import { CategorySelector } from "@/components/pim/CategorySelector";
 *    import { FeaturesForm } from "@/components/pim/FeaturesForm";
 *
 * 2. Add state to your product form component:
 *    const [productType, setProductType] = useState<any>(product?.product_type || null);
 *    const [collections, setCollections] = useState(product?.collections || []);
 *    const [category, setCategory] = useState(product?.category || null);
 *    const [featureValues, setFeatureValues] = useState(product?.product_type?.technical_features || []);
 *
 * 3. Place the components in your form:
 *    <ProductTypeSelector value={productType} onChange={setProductType} />
 *    <CategorySelector value={category} onChange={setCategory} />
 *    <CollectionsSelector value={collections} onChange={setCollections} />
 *    {productType?.featureDetails && (
 *      <FeaturesForm
 *        features={productType.featureDetails}
 *        values={featureValues}
 *        onChange={setFeatureValues}
 *      />
 *    )}
 *
 * 4. When saving, include these fields in your PATCH request:
 *    const updates = {
 *      ...existingFields,
 *      product_type: productType ? {
 *        id: productType.product_type_id,
 *        name: productType.name,
 *        slug: productType.slug,
 *        technical_features: featureValues,
 *      } : null,
 *      collections,
 *      category,
 *    };
 *
 * 5. Update your API route to handle these fields:
 *    In /api/b2b/pim/products/[entity_code]/route.ts:
 *
 *    if (product_type !== undefined) {
 *      updates.product_type = product_type;
 *    }
 *    if (collections !== undefined) {
 *      updates.collections = collections;
 *    }
 *    if (category !== undefined) {
 *      updates.category = category;
 *    }
 */
