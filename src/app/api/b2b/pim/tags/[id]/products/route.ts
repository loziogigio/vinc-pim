import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// GET /api/b2b/pim/tags/[id]/products - Get products linked to tag
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Tag: TagModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id: tagId } = await params;

    const tag = await TagModel.findOne({
      tag_id: tagId,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "tag.id": tagId,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { entity_code: { $regex: search, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name image status quantity")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
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
    console.error("Error fetching tag products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/tags/[id]/products - Associate/disassociate products
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Tag: TagModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id: tagId } = await params;

    const body = await req.json();
    const { entity_codes, action } = body as {
      entity_codes?: string[];
      action?: "add" | "remove";
    };

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

    const tag = await TagModel.findOne({
      tag_id: tagId,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (action === "add") {
      const tagData = {
        id: tagId,
        name: tag.name,
        slug: tag.slug,
      };

      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          // No wholesaler_id - database provides isolation
          isCurrent: true,
          "tag.id": { $ne: tagId },
        },
        { $addToSet: { tag: tagData } }
      );

      const productCount = await PIMProductModel.countDocuments({
        // No wholesaler_id - database provides isolation
        isCurrent: true,
        "tag.id": tagId,
      });

      await TagModel.updateOne(
        { tag_id: tagId }, // No wholesaler_id - database provides isolation
        { $set: { product_count: productCount } }
      );

      return NextResponse.json({
        message: `Successfully associated ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    }

    const result = await PIMProductModel.updateMany(
      {
        entity_code: { $in: entity_codes },
        // No wholesaler_id - database provides isolation
        isCurrent: true,
        "tag.id": tagId,
      },
      { $pull: { tag: { id: tagId } } }
    );

    const productCount = await PIMProductModel.countDocuments({
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "tag.id": tagId,
    });

    await TagModel.updateOne(
      { tag_id: tagId }, // No wholesaler_id - database provides isolation
      { $set: { product_count: productCount } }
    );

    return NextResponse.json({
      message: `Successfully removed ${result.modifiedCount} product(s)`,
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    console.error("Error updating tag products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update products" },
      { status: 500 }
    );
  }
}
