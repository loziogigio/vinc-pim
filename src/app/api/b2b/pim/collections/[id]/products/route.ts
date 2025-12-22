import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { CollectionModel } from "@/lib/db/models/collection";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

// GET /api/b2b/pim/collections/[collectionId]/products - Get products for a collection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const { id: collectionId } = await params;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Verify collection exists
    const collection = await CollectionModel.findOne({
      collection_id: collectionId,
    }).lean() as any;

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Build query - products that have this collection in their collections array
    const query: any = {
      isCurrent: true,
      "collections.collection_id": collectionId,
    };

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { entity_code: { $regex: search, $options: "i" } },
      ];
    }

    // Get products
    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name image images status quantity")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as any,
      PIMProductModel.countDocuments(query),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching collection products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/collections/[collectionId]/products - Bulk associate/disassociate products
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const { id: collectionId } = await params;

    const body = await req.json();
    const { entity_codes, action } = body;

    if (!entity_codes || !Array.isArray(entity_codes) || entity_codes.length === 0) {
      return NextResponse.json(
        { error: "entity_codes array is required" },
        { status: 400 }
      );
    }

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    // Verify collection exists
    const collection = await CollectionModel.findOne({
      collection_id: collectionId,
    }).lean() as any;

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    if (action === "add") {
      // Add collection to products' collections array
      // Store name and slug as multilingual objects using collection's locale
      const locale = collection.locale || "it";
      const collectionData = {
        collection_id: collectionId,
        name: { [locale]: collection.name },
        slug: { [locale]: collection.slug },
      };

      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          isCurrent: true,
          "collections.collection_id": { $ne: collectionId }, // Only if not already in array
        },
        { $push: { collections: collectionData } }
      );

      // Update collection product count
      const productCount = await PIMProductModel.countDocuments({
        isCurrent: true,
        "collections.collection_id": collectionId,
      });

      await CollectionModel.updateOne(
        { collection_id: collectionId },
        { $set: { product_count: productCount } }
      );

      // Sync affected products to Solr
      const adapterConfigs = loadAdapterConfigs();
      if (adapterConfigs.solr?.enabled) {
        const solrAdapter = new SolrAdapter(adapterConfigs.solr);
        const productsToSync = await PIMProductModel.find({
          entity_code: { $in: entity_codes },
          isCurrent: true,
        }).lean();

        for (const product of productsToSync) {
          await solrAdapter.syncProduct(product as any);
        }
        console.log(`🔄 Synced ${productsToSync.length} products to Solr after adding to collection`);
      }

      return NextResponse.json({
        message: `Successfully associated ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    } else {
      // Remove collection from products' collections array
      // Match by collection_id OR slug (for backwards compatibility with old data)
      const locale = collection.locale || "it";
      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          isCurrent: true,
          $or: [
            { "collections.collection_id": collectionId },
            { "collections.slug": collection.slug },
            { [`collections.slug.${locale}`]: collection.slug },
          ],
        },
        {
          $pull: {
            collections: {
              $or: [
                { collection_id: collectionId },
                { slug: collection.slug },
                { [`slug.${locale}`]: collection.slug },
              ],
            },
          },
        }
      );

      // Update collection product count
      const productCount = await PIMProductModel.countDocuments({
        isCurrent: true,
        $or: [
          { "collections.collection_id": collectionId },
          { "collections.slug": collection.slug },
          { [`collections.slug.${locale}`]: collection.slug },
        ],
      });

      await CollectionModel.updateOne(
        { collection_id: collectionId },
        { $set: { product_count: productCount } }
      );

      // Sync affected products to Solr (will have updated/empty collection_slugs)
      const adapterConfigs = loadAdapterConfigs();
      if (adapterConfigs.solr?.enabled) {
        const solrAdapter = new SolrAdapter(adapterConfigs.solr);
        const productsToSync = await PIMProductModel.find({
          entity_code: { $in: entity_codes },
          isCurrent: true,
        }).lean();

        for (const product of productsToSync) {
          await solrAdapter.syncProduct(product as any);
        }
        console.log(`🔄 Synced ${productsToSync.length} products to Solr after removing from collection`);
      }

      return NextResponse.json({
        message: `Successfully removed ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    }
  } catch (error: any) {
    console.error("Error updating collection products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update products" },
      { status: 500 }
    );
  }
}
