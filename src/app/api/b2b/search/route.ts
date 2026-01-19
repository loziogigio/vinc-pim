import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";

export async function POST(request: NextRequest) {
  try {
    // Check B2B authentication
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const params = await request.json();
    const {
      text = '',
      filters = {},
      start = 0,
      rows = 12,
      sort = 'relevance'
    } = params;

    const tenantDb = `vinc-${session.tenantId}`;
    const connection = await getPooledConnection(tenantDb);
    const db = connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    const collection = db.collection('products_b2b');

    // Build MongoDB query
    const query: any = {};

    // Text search
    if (text && text.trim()) {
      query.$text = { $search: text.trim() };
    }

    // Filters
    if (filters) {
      // Brand filter (use brand.brand_id per BrandBase standard)
      if (filters.brand && Array.isArray(filters.brand) && filters.brand.length > 0) {
        query['brand.brand_id'] = { $in: filters.brand };
      }

      // Category filter
      if (filters.category && Array.isArray(filters.category) && filters.category.length > 0) {
        query['category.code'] = { $in: filters.category };
      }

      // Custom filters (mapped field names)
      if (filters.codice_figura && Array.isArray(filters.codice_figura)) {
        query['parent_sku'] = { $in: filters.codice_figura };
      }

      if (filters.carti && Array.isArray(filters.carti)) {
        query['sku'] = { $in: filters.carti };
      }

      // Price range
      if (filters.min_price || filters.max_price) {
        query.price = {};
        if (filters.min_price) query.price.$gte = Number(filters.min_price);
        if (filters.max_price) query.price.$lte = Number(filters.max_price);
      }
    }

    // Build sort
    let sortCriteria: any = {};
    switch (sort) {
      case 'price_asc':
        sortCriteria = { price: 1 };
        break;
      case 'price_desc':
        sortCriteria = { price: -1 };
        break;
      case 'name_asc':
        sortCriteria = { title: 1 };
        break;
      case 'name_desc':
        sortCriteria = { title: -1 };
        break;
      case 'relevance':
      default:
        // If text search, sort by text score
        if (query.$text) {
          sortCriteria = { score: { $meta: 'textScore' } };
        } else {
          sortCriteria = { 'title': 1 };
        }
    }

    // Execute query with pagination
    const projection = query.$text
      ? { score: { $meta: 'textScore' } }
      : {};

    const results = await collection
      .find(query, { projection })
      .sort(sortCriteria)
      .skip(start * rows)
      .limit(rows)
      .toArray();

    // Get total count
    const numFound = await collection.countDocuments(query);

    return NextResponse.json({
      results,
      numFound,
      start,
      rows
    });

  } catch (error) {
    console.error("B2B search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
