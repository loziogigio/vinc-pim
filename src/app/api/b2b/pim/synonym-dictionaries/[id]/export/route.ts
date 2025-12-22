import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { SynonymDictionaryModel } from "@/lib/db/models/synonym-dictionary";
import { PIMProductModel } from "@/lib/db/models/pim-product";

// GET /api/b2b/pim/synonym-dictionaries/[id]/export - Export products as CSV
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    // Get the dictionary
    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    }).lean();

    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    // Get all products with this dictionary key
    const products = await PIMProductModel.find({
      isCurrent: true,
      synonym_keys: dictionary.key,
    })
      .select("entity_code sku name")
      .sort({ entity_code: 1 })
      .lean();

    // Build CSV content
    const csvLines: string[] = ["entity_code,sku,name"];

    for (const product of products) {
      const name =
        typeof product.name === "object"
          ? product.name?.it || product.name?.en || Object.values(product.name)[0] || ""
          : product.name || "";

      // Escape CSV values
      const escapedName = `"${name.replace(/"/g, '""')}"`;

      csvLines.push(`${product.entity_code},${product.sku || ""},${escapedName}`);
    }

    const csvContent = csvLines.join("\n");

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="synonym-dictionary-${dictionary.key}-products.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting synonym dictionary products:", error);
    return NextResponse.json(
      { error: "Failed to export products" },
      { status: 500 }
    );
  }
}
