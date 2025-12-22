import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { SynonymDictionaryModel } from "@/lib/db/models/synonym-dictionary";
import { nanoid } from "nanoid";

// GET /api/b2b/pim/synonym-dictionaries - List dictionaries
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const locale = searchParams.get("locale") || "";
    const isActive = searchParams.get("is_active");
    const includeInactive = searchParams.get("include_inactive") === "true";
    const sortBy = searchParams.get("sort_by") || "display_order";
    const sortOrder = searchParams.get("sort_order") === "desc" ? -1 : 1;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Build query
    const query: Record<string, unknown> = {};

    if (locale) {
      query.locale = locale.toLowerCase();
    }

    if (search) {
      query.$or = [
        { key: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { terms: { $regex: search, $options: "i" } },
      ];
    }

    if (!includeInactive && (isActive === null || isActive === undefined)) {
      query.is_active = true;
    } else if (isActive !== null && isActive !== undefined && isActive !== "") {
      query.is_active = isActive === "true";
    }

    const sort: Record<string, number> = { [sortBy]: sortOrder };

    const skip = (page - 1) * limit;
    const [dictionaries, total] = await Promise.all([
      SynonymDictionaryModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
      SynonymDictionaryModel.countDocuments(query),
    ]);

    return NextResponse.json({
      dictionaries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching synonym dictionaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch synonym dictionaries" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/synonym-dictionaries - Create dictionary
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { key, description, terms, locale, is_active, display_order } = body;

    if (!key || !key.trim()) {
      return NextResponse.json(
        { error: "Key is required" },
        { status: 400 }
      );
    }

    if (!locale || !locale.trim()) {
      return NextResponse.json(
        { error: "Locale is required" },
        { status: 400 }
      );
    }

    // Normalize key
    const normalizedKey = key
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const normalizedLocale = locale.toLowerCase().trim();

    // Check if key + locale combination already exists
    const existingDict = await SynonymDictionaryModel.findOne({
      key: normalizedKey,
      locale: normalizedLocale,
    });

    if (existingDict) {
      return NextResponse.json(
        { error: `A dictionary with key "${normalizedKey}" already exists for locale "${normalizedLocale}"` },
        { status: 409 }
      );
    }

    // Normalize terms
    const normalizedTerms = Array.isArray(terms)
      ? terms
          .map((term: string) => term.trim().toLowerCase())
          .filter((term: string) => term.length > 0)
      : [];

    // Create dictionary
    const dictionary = await SynonymDictionaryModel.create({
      dictionary_id: nanoid(12),
      key: normalizedKey,
      description: description?.trim() || undefined,
      terms: normalizedTerms,
      locale: normalizedLocale,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      display_order: display_order || 0,
      product_count: 0,
    });

    return NextResponse.json(
      { dictionary, message: "Synonym dictionary created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating synonym dictionary:", error);
    return NextResponse.json(
      { error: "Failed to create synonym dictionary" },
      { status: 500 }
    );
  }
}
