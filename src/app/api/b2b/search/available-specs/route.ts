import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { getSolrConfig, isSolrEnabled } from "@/config/project.config";

/**
 * GET /api/b2b/search/available-specs
 * Get available technical specification fields for filtering and faceting
 *
 * Query params:
 * - product_type_id: Filter to specs from products of a specific type (optional)
 * - limit: Number of sample products to check (default: 100)
 *
 * Returns:
 * {
 *   specs: [
 *     {
 *       key: "weight",
 *       field: "spec_weight_f",
 *       type: "number",
 *       label: "Peso"  // from first product found
 *     },
 *     ...
 *   ]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        { error: "Search is not enabled" },
        { status: 503 }
      );
    }

    // Authenticate
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "read");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { searchParams } = new URL(req.url);
    const productTypeId = searchParams.get("product_type_id");
    const productTypeCode = searchParams.get("product_type_code");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Build Solr query to get sample products
    const solrConfig = getSolrConfig();
    const solrCore = tenantDb; // Same as tenant DB name

    // Build filter queries
    const fq: string[] = [
      "include_faceting:true",
      "technical_specifications_json:*",  // Only products with technical specs
    ];
    // Filter by product_type_id or product_type_code (customer's ERP code)
    if (productTypeId) {
      fq.push(`product_type_id:${productTypeId}`);
    } else if (productTypeCode) {
      fq.push(`product_type_code:${productTypeCode}`);
    }

    // Query Solr for sample products that have technical specifications
    const solrQuery = {
      query: "*:*",
      filter: fq,
      limit,
      fields: "*, spec_*",  // Explicitly request all fields including dynamic spec_* fields
    };

    const solrResponse = await fetch(
      `${solrConfig.url}/${solrCore}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(solrQuery),
      }
    );

    if (!solrResponse.ok) {
      const errorText = await solrResponse.text();
      console.error("Solr query error:", errorText);
      return NextResponse.json(
        { error: "Search service error" },
        { status: 503 }
      );
    }

    const solrData = await solrResponse.json();
    const docs = solrData.response?.docs || [];

    // Collect all spec_* fields from documents
    const specFieldsMap = new Map<
      string,
      {
        key: string;
        field: string;
        type: "string" | "number" | "boolean" | "array";
        label?: string;
        sampleValues: Set<string | number | boolean>;
      }
    >();

    for (const doc of docs) {
      // Parse technical_specifications_json to get labels
      let specLabels: Record<string, string> = {};
      if (doc.technical_specifications_json) {
        try {
          const specs = JSON.parse(doc.technical_specifications_json);
          // Get specs from first available language
          const langSpecs = specs.it || specs.en || specs.de || (Array.isArray(specs) ? specs : []);
          if (Array.isArray(langSpecs)) {
            for (const spec of langSpecs) {
              if (spec.key && spec.label) {
                specLabels[spec.key] = spec.label;
              }
            }
          }
        } catch {
          // Ignore parsing errors
        }
      }

      // Find all spec_* fields (excluding spec_labels_text_*)
      for (const [fieldName, value] of Object.entries(doc)) {
        if (fieldName.startsWith("spec_") && !fieldName.startsWith("spec_labels_")) {
          // Parse field name to get key and suffix
          // Format: spec_{key}_{suffix}
          const match = fieldName.match(/^spec_(.+)_([sfb]|ss|fs)$/);
          if (match) {
            const [, key, suffix] = match;

            // Determine type from suffix
            let type: "string" | "number" | "boolean" | "array" = "string";
            if (suffix === "f") type = "number";
            else if (suffix === "b") type = "boolean";
            else if (suffix === "ss" || suffix === "fs") type = "array";

            // Get or create entry
            if (!specFieldsMap.has(key)) {
              specFieldsMap.set(key, {
                key,
                field: fieldName,
                type,
                label: specLabels[key],
                sampleValues: new Set(),
              });
            }

            // Add sample value
            const entry = specFieldsMap.get(key)!;
            if (value !== undefined && value !== null) {
              if (Array.isArray(value)) {
                value.slice(0, 3).forEach((v: string | number | boolean) => entry.sampleValues.add(v));
              } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                entry.sampleValues.add(value);
              }
            }

            // Update label if not set
            if (!entry.label && specLabels[key]) {
              entry.label = specLabels[key];
            }
          }
        }
      }
    }

    // Convert to array and limit sample values
    const specs = Array.from(specFieldsMap.values()).map(({ sampleValues, ...spec }) => ({
      ...spec,
      sample_values: Array.from(sampleValues).slice(0, 5),
    }));

    // Sort by key
    specs.sort((a, b) => a.key.localeCompare(b.key));

    return NextResponse.json({
      specs,
      total_products_checked: docs.length,
      product_type_id: productTypeId || null,
    });
  } catch (error) {
    console.error("Error getting available specs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
