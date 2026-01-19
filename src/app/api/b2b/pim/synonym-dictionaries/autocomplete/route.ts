import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// GET /api/b2b/pim/synonym-dictionaries/autocomplete - Autocomplete search
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { SynonymDictionary: SynonymDictionaryModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const locale = searchParams.get("locale") || "";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Build search query
    const searchQuery: Record<string, unknown> = {
      is_active: true,
      terms: { $regex: query, $options: "i" },
    };

    if (locale) {
      searchQuery.locale = locale.toLowerCase();
    }

    // Find dictionaries where any term matches
    const dictionaries = await SynonymDictionaryModel.find(searchQuery)
      .select("dictionary_id key terms locale")
      .limit(50) // Get more dictionaries to find enough matching terms
      .lean();

    // Build suggestions from matching terms
    const suggestions: {
      term: string;
      key: string;
      dictionary_id: string;
      locale: string;
    }[] = [];

    const queryLower = query.toLowerCase();
    const seenKeys = new Set<string>();

    for (const dict of dictionaries) {
      // Find matching terms in this dictionary
      for (const term of dict.terms) {
        if (term.toLowerCase().includes(queryLower)) {
          // Only add one suggestion per key to avoid duplicates
          const uniqueKey = `${dict.key}-${dict.locale}`;
          if (!seenKeys.has(uniqueKey)) {
            suggestions.push({
              term,
              key: dict.key,
              dictionary_id: dict.dictionary_id,
              locale: dict.locale,
            });
            seenKeys.add(uniqueKey);
          }

          // Stop if we have enough suggestions
          if (suggestions.length >= limit) {
            break;
          }
        }
      }

      if (suggestions.length >= limit) {
        break;
      }
    }

    // Sort by how close the match is to the beginning of the term
    suggestions.sort((a, b) => {
      const aIndex = a.term.toLowerCase().indexOf(queryLower);
      const bIndex = b.term.toLowerCase().indexOf(queryLower);
      return aIndex - bIndex;
    });

    return NextResponse.json({
      suggestions: suggestions.slice(0, limit),
    });
  } catch (error) {
    console.error("Error in autocomplete:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
