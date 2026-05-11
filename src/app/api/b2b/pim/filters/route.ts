import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { safeRegexQuery } from "@/lib/security";
import { distinctMultilingualValues } from "@/lib/db/multilingual-aggregation";

/**
 * GET /api/b2b/pim/filters
 * Get available filter options (brands, categories, currencies)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // brand, category, currency
    const search = searchParams.get("search") || "";

    const query: any = {
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    };

    let results: string[] = [];

    switch (type) {
      case "brand":
        // brand.label is a plain string field
        const brandAgg = await PIMProduct.aggregate([
          { $match: { ...query, "brand.label": { $exists: true, $nin: [null, ""] } } },
          { $group: { _id: "$brand.label" } },
          ...(search ? [{ $match: { _id: safeRegexQuery(search) } }] : []),
          { $sort: { _id: 1 } },
          { $limit: 10 },
        ]);
        results = brandAgg.map((b: { _id: string }) => b._id).filter(Boolean);
        break;

      case "category":
        // category.name is MultilingualText (e.g., {it: "Cavi", en: "Cables"}) —
        // extract distinct string values across all languages.
        results = await distinctMultilingualValues(PIMProduct, "category.name", query, search);
        break;

      case "product_type":
        // product_type.name is MultilingualText
        results = await distinctMultilingualValues(PIMProduct, "product_type.name", query, search);
        break;

      case "currency":
        // Get distinct currencies
        const currencies = await PIMProduct.distinct("currency", {
          ...query,
          currency: { $exists: true, $ne: null, $nin: [""] },
          ...(search && { currency: safeRegexQuery(search) }),
        });
        results = currencies.filter((c) => c).sort();
        break;

      default:
        return NextResponse.json(
          { error: "Invalid filter type" },
          { status: 400 }
        );
    }

    // Limit to 10 results for better UX
    results = results.slice(0, 10);

    return NextResponse.json({
      [type + "s"]: results,
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
