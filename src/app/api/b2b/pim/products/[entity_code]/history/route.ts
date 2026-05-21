import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const LIST_PROJECTION = {
  entity_code: 1,
  sku: 1,
  name: 1,
  description: 1,
  version: 1,
  isCurrent: 1,
  isCurrentPublished: 1,
  status: 1,
  published_at: 1,
  images: 1,
  brand: 1,
  category: 1,
  completeness_score: 1,
  critical_issues: 1,
  source: 1,
  manually_edited: 1,
  edited_by: 1,
  edited_at: 1,
  created_at: 1,
  updated_at: 1,
} as const;

/**
 * GET /api/b2b/pim/products/[entity_code]/history
 * Paginated list of versions for a product with server-side filtering.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity_code } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const filter = buildVersionFilter(entity_code, searchParams);

    const [total, items] = await Promise.all([
      PIMProductModel.countDocuments(filter),
      PIMProductModel.find(filter, LIST_PROJECTION)
        .sort({ version: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    // 404 only when there is genuinely no version of this product at all,
    // not when the active filters returned an empty page.
    if (total === 0 && !hasActiveFilters(searchParams)) {
      const exists = await PIMProductModel.exists({ entity_code });
      if (!exists) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
    }

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching product history:", error);
    return NextResponse.json(
      { error: "Failed to fetch product history", details: error.message },
      { status: 500 }
    );
  }
}

function hasActiveFilters(sp: URLSearchParams): boolean {
  return Boolean(
    sp.get("search") ||
      (sp.get("status") && sp.get("status") !== "all") ||
      (sp.get("editType") && sp.get("editType") !== "all") ||
      (sp.get("dateRange") && sp.get("dateRange") !== "all") ||
      sp.get("dateFrom") ||
      sp.get("dateTo")
  );
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function buildVersionFilter(
  entity_code: string,
  sp: URLSearchParams
): Record<string, unknown> {
  const filter: Record<string, unknown> = { entity_code };

  const status = sp.get("status");
  if (status && status !== "all") {
    filter.status = status;
  }

  const editType = sp.get("editType");
  if (editType === "manual") {
    filter.manually_edited = true;
  } else if (editType === "api") {
    filter.manually_edited = { $ne: true };
  }

  // Date/time range — supports explicit dateFrom/dateTo (ISO strings) and the
  // quick presets used by the page (`dateRange=7days|30days|all`).
  const dateRange = sp.get("dateRange");
  const dateFrom = parseDate(sp.get("dateFrom"));
  const dateTo = parseDate(sp.get("dateTo"));
  const range: { $gte?: Date; $lte?: Date } = {};

  if (dateFrom) range.$gte = dateFrom;
  if (dateTo) range.$lte = dateTo;

  if (!range.$gte && (dateRange === "7days" || dateRange === "30days")) {
    const days = dateRange === "7days" ? 7 : 30;
    range.$gte = new Date(Date.now() - days * 86_400_000);
  }

  if (range.$gte || range.$lte) {
    filter.created_at = range;
  }

  const search = sp.get("search")?.trim();
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [
      { sku: rx },
      { "name.it": rx },
      { "name.en": rx },
      { "name.sk": rx },
      { "description.it": rx },
      { "description.en": rx },
      { "description.sk": rx },
    ];
  }

  return filter;
}
