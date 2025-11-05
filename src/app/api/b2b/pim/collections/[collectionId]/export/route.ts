import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { CollectionModel } from "@/lib/db/models/collection";

// GET /api/b2b/pim/collections/[collectionId]/export - Export products
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Await params (Next.js 15+)
    const { collectionId } = await params;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv"; // csv, xlsx, txt

    if (!["csv", "xlsx", "txt"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be csv, xlsx, or txt" },
        { status: 400 }
      );
    }

    // Verify collection belongs to this wholesaler
    const collection = await CollectionModel.findOne({
      collection_id: collectionId,
      wholesaler_id: session.userId,
    }).lean() as any;

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Get all products for this collection
    const products = await PIMProductModel.find({
      wholesaler_id: session.userId,
      isCurrent: true,
      "collections.id": collectionId,
    })
      .select("entity_code sku name")
      .lean() as any[];

    if (format === "txt") {
      // Simple text file with one entity_code per line
      const content = products.map(p => p.entity_code).join("\n");
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="collection-${collection.slug}-products.txt"`,
        },
      });
    }

    if (format === "csv") {
      // CSV format: entity_code,sku,name
      const header = "entity_code,sku,name\n";
      const rows = products.map(p =>
        `${p.entity_code},${p.sku},"${p.name.replace(/"/g, '""')}"`
      ).join("\n");
      const content = header + rows;

      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="collection-${collection.slug}-products.csv"`,
        },
      });
    }

    if (format === "xlsx") {
      // For XLSX, we'll use a library in production, but for now return CSV
      // TODO: Implement XLSX generation using a library like xlsx or exceljs
      const header = "entity_code,sku,name\n";
      const rows = products.map(p =>
        `${p.entity_code},${p.sku},"${p.name.replace(/"/g, '""')}"`
      ).join("\n");
      const content = header + rows;

      return new NextResponse(content, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="collection-${collection.slug}-products.xlsx"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (error: any) {
    console.error("Error exporting collection products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export products" },
      { status: 500 }
    );
  }
}
