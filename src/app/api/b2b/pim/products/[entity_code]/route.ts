import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/products/[entity_code]?version=X
 * Get a single product by entity_code
 * - If version parameter is provided, fetch that specific version
 * - Otherwise, fetch the current version
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;

    // Check if specific version is requested
    const searchParams = req.nextUrl.searchParams;
    const versionParam = searchParams.get("version");

    let product;
    let currentVersion;

    if (versionParam) {
      // Fetch specific version
      const version = parseInt(versionParam);
      product = await PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        version,
      }).lean();

      // Also fetch current version info for comparison
      currentVersion = await PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      })
        .select("version")
        .lean();
    } else {
      // Fetch current version
      product = await PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      }).lean();
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const response: any = { product };

    // Include current version info if viewing old version
    if (versionParam && currentVersion) {
      response.currentVersion = currentVersion.version;
      response.isOldVersion = product.version !== currentVersion.version;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/pim/products/[entity_code]
 * Update a product
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;
    const updates = await req.json();

    // Build update document
    const updateDoc: any = {
      updated_at: new Date(),
    };

    // Allow updating specific fields
    const allowedFields = [
      "name",
      "description",
      "short_description",
      "price",
      "currency",
      "stock_quantity",
      "status",
      "brand",
      "category",
      "attributes",
      "dimensions",
      "weight",
      "tags",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateDoc[field] = updates[field];
      }
    });

    // Handle stock_quantity -> quantity field mapping
    if (updates.stock_quantity !== undefined) {
      updateDoc.quantity = updates.stock_quantity;
      delete updateDoc.stock_quantity;
    }

    const product = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      },
      { $set: updateDoc },
      { new: true }
    ).lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      product,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
