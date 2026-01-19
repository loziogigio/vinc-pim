import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// GET /api/b2b/pim/brands/[id]/export - Export products
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Brand: BrandModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    // Await params (Next.js 15+)
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv"; // csv, xlsx, txt

    if (!["csv", "xlsx", "txt"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be csv, xlsx, or txt" },
        { status: 400 }
      );
    }

    // Verify brand exists (no wholesaler_id - database provides isolation)
    const brand = await BrandModel.findOne({
      brand_id: id,
    }).lean() as any;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Get all products for this brand (no wholesaler_id - database provides isolation)
    const products = await PIMProductModel.find({
      isCurrent: true,
      "brand.id": id,
    })
      .select("entity_code sku name")
      .lean() as any[];

    if (format === "txt") {
      // Simple text file with one entity_code per line
      const content = products.map(p => p.entity_code).join("\n");
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="brand-${brand.slug}-products.txt"`,
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
          "Content-Disposition": `attachment; filename="brand-${brand.slug}-products.csv"`,
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
          "Content-Disposition": `attachment; filename="brand-${brand.slug}-products.xlsx"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (error: any) {
    console.error("Error exporting brand products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export products" },
      { status: 500 }
    );
  }
}
