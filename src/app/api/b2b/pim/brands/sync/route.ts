import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

interface BrandSyncItem {
  brand_id: string;
  label: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;
}

function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// POST /api/b2b/pim/brands/sync - Bulk upsert brands (API key auth supported)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { Brand: BrandModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { brands } = body as { brands: BrandSyncItem[] };

    if (!brands || !Array.isArray(brands) || brands.length === 0) {
      return NextResponse.json(
        { error: "brands array is required and must not be empty" },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: { brand_id: string; error: string }[] = [];

    for (const item of brands) {
      if (!item.brand_id || !item.label) {
        failed++;
        errors.push({
          brand_id: item.brand_id || "unknown",
          error: "brand_id and label are required",
        });
        continue;
      }

      try {
        const slug = item.slug || generateSlug(item.label);

        const result = await BrandModel.findOneAndUpdate(
          { brand_id: item.brand_id },
          {
            $set: {
              label: item.label.trim(),
              slug,
              description: item.description?.trim() || undefined,
              logo_url: item.logo_url?.trim() || undefined,
              website_url: item.website_url?.trim() || undefined,
              is_active: item.is_active ?? true,
              product_count: item.product_count ?? 0,
              display_order: item.display_order ?? 0,
            },
            $setOnInsert: {
              brand_id: item.brand_id,
            },
          },
          { upsert: true, new: true, rawResult: true }
        );

        if (result.lastErrorObject?.updatedExisting) {
          updated++;
        } else {
          created++;
        }
      } catch (err: any) {
        failed++;
        errors.push({
          brand_id: item.brand_id,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      stats: { created, updated, failed, total: brands.length },
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: any) {
    console.error("Error syncing brands:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync brands" },
      { status: 500 }
    );
  }
}
