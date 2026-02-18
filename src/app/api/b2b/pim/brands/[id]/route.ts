import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// GET /api/b2b/pim/brands/[id] - Get single brand
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
    const { Brand: BrandModel } = await connectWithModels(tenantDb);

    const brand = await BrandModel.findOne({
      brand_id: id,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json({ brand });
  } catch (error) {
    console.error("Error fetching brand:", error);
    return NextResponse.json(
      { error: "Failed to fetch brand" },
      { status: 500 }
    );
  }
}

// PATCH /api/b2b/pim/brands/[id] - Update brand
export async function PATCH(
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
    const { Brand: BrandModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { label, slug, description, logo_url, website_url, is_active, display_order } = body;

    // Find existing brand (no wholesaler_id - database provides isolation)
    const existingBrand = await BrandModel.findOne({
      brand_id: id,
    });

    if (!existingBrand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // If slug is being changed, check for conflicts (no wholesaler_id - database provides isolation)
    if (slug && slug !== existingBrand.slug) {
      const conflictingBrand = await BrandModel.findOne({
        slug: slug,
        brand_id: { $ne: id },
      });

      if (conflictingBrand) {
        return NextResponse.json(
          { error: "A brand with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // Update fields
    if (label !== undefined) existingBrand.label = label.trim();
    if (slug !== undefined) existingBrand.slug = slug.trim().toLowerCase();
    if (description !== undefined) existingBrand.description = description?.trim() || undefined;
    if (logo_url !== undefined) existingBrand.logo_url = logo_url?.trim() || undefined;
    if (website_url !== undefined) existingBrand.website_url = website_url?.trim() || undefined;
    if (is_active !== undefined) existingBrand.is_active = is_active;
    if (display_order !== undefined) existingBrand.display_order = display_order;

    await existingBrand.save();

    return NextResponse.json({
      brand: existingBrand,
      message: "Brand updated successfully",
    });
  } catch (error) {
    console.error("Error updating brand:", error);
    return NextResponse.json(
      { error: "Failed to update brand" },
      { status: 500 }
    );
  }
}

// DELETE /api/b2b/pim/brands/[id] - Delete brand
export async function DELETE(
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
    const { Brand: BrandModel } = await connectWithModels(tenantDb);

    const brand = await BrandModel.findOne({
      brand_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Check if brand has products
    if (brand.product_count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete brand with ${brand.product_count} associated products`,
        },
        { status: 400 }
      );
    }

    await BrandModel.deleteOne({
      brand_id: id,
      // No wholesaler_id - database provides isolation
    });

    return NextResponse.json({ message: "Brand deleted successfully" });
  } catch (error) {
    console.error("Error deleting brand:", error);
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}
