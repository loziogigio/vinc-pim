import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportSourceModel } from "@/lib/db/models/import-source";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/sources/[source_id]
 * Get a single import source with statistics
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  try {
    // TODO: Re-enable authentication
    // const session = await getB2BSession();
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await connectToDatabase();

    const { source_id } = await params;

    const source = await ImportSourceModel.findOne({ source_id });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Get additional statistics
    const productCount = await PIMProductModel.countDocuments({
      "source.source_id": source_id,
      isCurrent: true,
    });

    const publishedCount = await PIMProductModel.countDocuments({
      "source.source_id": source_id,
      isCurrent: true,
      status: "published",
    });

    return NextResponse.json({
      source,
      statistics: {
        total_products: productCount,
        published_products: publishedCount,
        draft_products: productCount - publishedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching source:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/pim/sources/[source_id]
 * Update an import source
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  try {
    // TODO: Re-enable authentication
    // const session = await getB2BSession();
    // if (!session || session.role !== "admin") {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await connectToDatabase();

    const { source_id } = await params;
    const body = await req.json();

    // Fields that can be updated
    const allowedFields = [
      "source_name",
      "source_type",
      "field_mappings",
      "auto_publish_enabled",
      "min_score_threshold",
      "required_fields",
      "overwrite_level",
      "is_active",
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    updateData.updated_at = new Date();

    const source = await ImportSourceModel.findOneAndUpdate(
      { source_id },
      updateData,
      { new: true }
    );

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json({ source });
  } catch (error) {
    console.error("Error updating source:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/sources/[source_id]
 * Delete an import source (soft delete)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  try {
    // TODO: Re-enable authentication
    // const session = await getB2BSession();
    // if (!session || session.role !== "admin") {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await connectToDatabase();

    const { source_id } = await params;

    // Check if source has products
    const productCount = await PIMProductModel.countDocuments({
      "source.source_id": source_id,
      isCurrent: true,
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete source with ${productCount} active products. Archive it instead.`,
        },
        { status: 400 }
      );
    }

    const source = await ImportSourceModel.findOneAndUpdate(
      { source_id },
      { is_active: false, updated_at: new Date() },
      { new: true }
    );

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Source archived successfully" });
  } catch (error) {
    console.error("Error deleting source:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
