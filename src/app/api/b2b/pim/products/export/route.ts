import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * POST /api/b2b/pim/products/export
 * Export selected products to CSV
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { product_ids } = body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json(
        { error: "product_ids array is required" },
        { status: 400 }
      );
    }

    // Fetch products
    const products = await PIMProductModel.find({
      _id: { $in: product_ids },
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    })
      .sort({ entity_code: 1 })
      .lean();

    if (products.length === 0) {
      return NextResponse.json(
        { error: "No products found" },
        { status: 404 }
      );
    }

    // Generate CSV
    const csv = generateCSV(products);

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting products:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateCSV(products: any[]): string {
  // Define CSV headers
  const headers = [
    "Entity Code",
    "SKU",
    "Name",
    "Brand",
    "Category",
    "Price",
    "Currency",
    "Status",
    "Completeness Score",
    "Critical Issues",
    "Views (30d)",
    "Priority Score",
    "Batch ID",
    "Source",
    "Updated At",
  ];

  // Create CSV rows
  const rows = products.map((product) => {
    return [
      escapeCsvValue(product.entity_code || ""),
      escapeCsvValue(product.sku || ""),
      escapeCsvValue(product.name || ""),
      escapeCsvValue(product.brand?.name || ""),
      escapeCsvValue(product.category?.name || ""),
      product.price || "",
      escapeCsvValue(product.currency || ""),
      escapeCsvValue(product.status || ""),
      product.completeness_score || 0,
      escapeCsvValue(product.critical_issues?.join("; ") || ""),
      product.analytics?.views_30d || 0,
      product.analytics?.priority_score || 0,
      escapeCsvValue(product.source?.batch_id || ""),
      escapeCsvValue(product.source?.source_name || ""),
      product.updated_at
        ? new Date(product.updated_at).toISOString()
        : "",
    ];
  });

  // Combine headers and rows
  const csvLines = [headers, ...rows].map((row) => row.join(","));

  return csvLines.join("\n");
}

function escapeCsvValue(value: string): string {
  if (!value) return "";

  // If the value contains comma, newline, or double quote, wrap it in quotes
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    // Escape double quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
