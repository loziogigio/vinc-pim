import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

// GET /api/b2b/pim/synonym-dictionaries/[id] - Fetch single dictionary
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb } = auth;
  try {
    const { SynonymDictionary: SynonymDictionaryModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id } = await params;

    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    }).lean();

    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    // Get actual product count
    const productCount = await PIMProductModel.countDocuments({
      isCurrent: true,
      synonym_keys: dictionary.key,
    });

    return NextResponse.json({
      dictionary: {
        ...dictionary,
        product_count: productCount,
      },
    });
  } catch (error) {
    console.error("Error fetching synonym dictionary:", error);
    return NextResponse.json(
      { error: "Failed to fetch synonym dictionary" },
      { status: 500 }
    );
  }
}

// PATCH /api/b2b/pim/synonym-dictionaries/[id] - Update dictionary
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb } = auth;
  try {
    const { SynonymDictionary: SynonymDictionaryModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id } = await params;
    const body = await req.json();
    const { key, description, terms, is_active, display_order } = body;

    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    });

    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    // If key is being changed, check for conflicts
    if (key && key !== dictionary.key) {
      const normalizedKey = key
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const conflict = await SynonymDictionaryModel.findOne({
        key: normalizedKey,
        locale: dictionary.locale,
        dictionary_id: { $ne: id },
      });

      if (conflict) {
        return NextResponse.json(
          { error: `A dictionary with key "${normalizedKey}" already exists for locale "${dictionary.locale}"` },
          { status: 409 }
        );
      }

      // Update synonym_keys in all products that reference the old key
      const oldKey = dictionary.key;
      await PIMProductModel.updateMany(
        { isCurrent: true, synonym_keys: oldKey },
        { $set: { "synonym_keys.$[elem]": normalizedKey } },
        { arrayFilters: [{ elem: oldKey }] }
      );

      dictionary.key = normalizedKey;
    }

    if (description !== undefined) {
      dictionary.description = description?.trim() || undefined;
    }

    if (terms !== undefined) {
      dictionary.terms = Array.isArray(terms)
        ? terms
            .map((term: string) => term.trim().toLowerCase())
            .filter((term: string) => term.length > 0)
        : [];
    }

    if (is_active !== undefined) {
      dictionary.is_active = Boolean(is_active);
    }

    if (display_order !== undefined) {
      dictionary.display_order = display_order;
    }

    const termsChanged = terms !== undefined;
    dictionary.updated_at = new Date();
    await dictionary.save();

    // Fire-and-forget: re-sync associated products to Solr when terms change
    if (termsChanged) {
      const adapterConfigs = loadAdapterConfigs();
      if (adapterConfigs.solr?.enabled) {
        const solrAdapter = new SolrAdapter(adapterConfigs.solr, tenantDb);
        PIMProductModel.find({ synonym_keys: dictionary.key, isCurrent: true })
          .lean()
          .then(async (products) => {
            let synced = 0;
            for (const product of products) {
              try {
                const result = await solrAdapter.syncProduct(product as any);
                if (result.success) synced++;
              } catch (err: any) {
                console.warn(`Solr sync failed for ${product.entity_code}:`, err.message);
              }
            }
            console.log(`Synonym dictionary "${dictionary.key}": synced ${synced}/${products.length} products to Solr`);
          })
          .catch((err) => {
            console.error(`Failed to sync products for dictionary "${dictionary.key}":`, err);
          });
      }
    }

    return NextResponse.json({
      dictionary,
      message: "Synonym dictionary updated successfully",
    });
  } catch (error) {
    console.error("Error updating synonym dictionary:", error);
    return NextResponse.json(
      { error: "Failed to update synonym dictionary" },
      { status: 500 }
    );
  }
}

// DELETE /api/b2b/pim/synonym-dictionaries/[id] - Delete dictionary
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb } = auth;
  try {
    const { SynonymDictionary: SynonymDictionaryModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id } = await params;

    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    });

    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    // Check for associated products
    const productCount = await PIMProductModel.countDocuments({
      isCurrent: true,
      synonym_keys: dictionary.key,
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete dictionary with ${productCount} associated products. Remove the dictionary from those products first.`,
        },
        { status: 400 }
      );
    }

    await SynonymDictionaryModel.deleteOne({ dictionary_id: id });

    return NextResponse.json({
      success: true,
      message: "Synonym dictionary deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting synonym dictionary:", error);
    return NextResponse.json(
      { error: "Failed to delete synonym dictionary" },
      { status: 500 }
    );
  }
}
