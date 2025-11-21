import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/filters
 * Get available filter options (brands, categories, currencies)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

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
        // Get distinct brand names
        const brands = await PIMProductModel.distinct("brand.name", {
          ...query,
          "brand.name": { $exists: true, $ne: null, $nin: [""] },
          ...(search && { "brand.name": { $regex: search, $options: "i" } }),
        });
        results = brands.filter((b) => b).sort();
        break;

      case "category":
        // Get distinct category names
        const categories = await PIMProductModel.distinct("category.name", {
          ...query,
          "category.name": { $exists: true, $ne: null, $nin: [""] },
          ...(search && { "category.name": { $regex: search, $options: "i" } }),
        });
        results = categories.filter((c) => c).sort();
        break;

      case "currency":
        // Get distinct currencies
        const currencies = await PIMProductModel.distinct("currency", {
          ...query,
          currency: { $exists: true, $ne: null, $nin: [""] },
          ...(search && { currency: { $regex: search, $options: "i" } }),
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
