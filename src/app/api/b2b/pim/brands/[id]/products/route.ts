import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// GET /api/b2b/pim/brands/[id]/products - Get products for a brand
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Brand: BrandModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Verify brand exists
    const brand = await BrandModel.findOne({
      brand_id: id,
      // No wholesaler_id - database provides isolation
    }).lean() as any;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Build query
    const query: any = {
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "brand.id": id,
    };

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { entity_code: { $regex: search, $options: "i" } },
      ];
    }

    // Get products
    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name image status quantity")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as any,
      PIMProductModel.countDocuments(query),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching brand products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/brands/[id]/products - Bulk associate/disassociate products
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Brand: BrandModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { entity_codes, action } = body;

    if (!entity_codes || !Array.isArray(entity_codes) || entity_codes.length === 0) {
      return NextResponse.json(
        { error: "entity_codes array is required" },
        { status: 400 }
      );
    }

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    // Verify brand exists
    const brand = await BrandModel.findOne({
      brand_id: id,
      // No wholesaler_id - database provides isolation
    }).lean() as any;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    if (action === "add") {
      // Associate products with brand
      const updateData: any = {
        "brand.id": id,
        "brand.name": brand.label,
        "brand.slug": brand.slug,
      };

      if (brand.logo_url) {
        updateData["brand.image"] = {
          id: id,
          thumbnail: brand.logo_url,
          original: brand.logo_url,
        };
      }

      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          // No wholesaler_id - database provides isolation
          isCurrent: true,
        },
        { $set: updateData }
      );

      // Update brand product count
      const productCount = await PIMProductModel.countDocuments({
        // No wholesaler_id - database provides isolation
        isCurrent: true,
        "brand.id": id,
      });

      await BrandModel.updateOne(
        { brand_id: id }, // No wholesaler_id - database provides isolation
        { $set: { product_count: productCount } }
      );

      return NextResponse.json({
        message: `Successfully associated ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    } else {
      // Remove brand from products
      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          // No wholesaler_id - database provides isolation
          isCurrent: true,
          "brand.id": id,
        },
        { $unset: { brand: "" } }
      );

      // Update brand product count
      const productCount = await PIMProductModel.countDocuments({
        // No wholesaler_id - database provides isolation
        isCurrent: true,
        "brand.id": id,
      });

      await BrandModel.updateOne(
        { brand_id: id }, // No wholesaler_id - database provides isolation
        { $set: { product_count: productCount } }
      );

      return NextResponse.json({
        message: `Successfully removed ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    }
  } catch (error: any) {
    console.error("Error updating brand products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update products" },
      { status: 500 }
    );
  }
}
