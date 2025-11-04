import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { CollectionModel } from "@/lib/db/models/collection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * PATCH /api/b2b/pim/collections/[collectionId]
 * Update a collection
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { collectionId: string } }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { collectionId } = params;
    const body = await req.json();
    const { name, slug, description, hero_image, seo, display_order, is_active } = body;

    // Check if collection exists and belongs to wholesaler
    const collection = await CollectionModel.findOne({
      collection_id: collectionId,
      wholesaler_id: session.userId,
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // If slug is changing, check for duplicates
    if (slug && slug !== collection.slug) {
      const existing = await CollectionModel.findOne({
        wholesaler_id: session.userId,
        slug,
        collection_id: { $ne: collectionId },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A collection with this slug already exists" },
          { status: 400 }
        );
      }
    }

    // Update collection
    const updateData: any = {
      updated_at: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (hero_image !== undefined) updateData.hero_image = hero_image;
    if (seo !== undefined) updateData.seo = seo;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedCollection = await CollectionModel.findOneAndUpdate(
      { collection_id: collectionId, wholesaler_id: session.userId },
      updateData,
      { new: true }
    );

    return NextResponse.json({ collection: updatedCollection });
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/collections/[collectionId]
 * Delete a collection
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { collectionId: string } }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { collectionId } = params;

    // Check if collection exists and belongs to wholesaler
    const collection = await CollectionModel.findOne({
      collection_id: collectionId,
      wholesaler_id: session.userId,
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Check if collection has products
    const productCount = await PIMProductModel.countDocuments({
      wholesaler_id: session.userId,
      isCurrent: true,
      "collection.id": collectionId,
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete collection with ${productCount} products. Please reassign them first.`,
        },
        { status: 400 }
      );
    }

    // Delete collection
    await CollectionModel.deleteOne({
      collection_id: collectionId,
      wholesaler_id: session.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
