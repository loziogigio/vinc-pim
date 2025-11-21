/**
 * Batch Product Operations API
 * Comprehensive API for bulk product updates and language synchronization
 */

import { Router, Request, Response } from "express";
import { ProductModel } from "../lib/db/models/product";
import { getEnabledLanguages } from "../services/language.service";
import axios from "axios";
import { projectConfig } from "../config/project.config";

const router = Router();

// ============================================================================
// Batch Update Endpoints
// ============================================================================

/**
 * POST /api/products/batch-update
 * Update multiple products at once
 */
router.post("/batch-update", async (req: Request, res: Response) => {
  try {
    const { updates, reindexSolr = true } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of product updates"
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      const { sku, data } = update;

      if (!sku) {
        errors.push({ sku: "unknown", error: "SKU is required" });
        continue;
      }

      try {
        const product = await ProductModel.findOne({ sku });

        if (!product) {
          errors.push({ sku, error: "Product not found" });
          continue;
        }

        // Update product fields
        Object.assign(product, data);
        await product.save();

        results.push({
          sku,
          _id: product._id,
          updated: true
        });
      } catch (error: any) {
        errors.push({ sku, error: error.message });
      }
    }

    // Reindex to Solr
    if (reindexSolr && results.length > 0) {
      try {
        await reindexProductsToSolr(results.map(r => r.sku));
      } catch (solrError: any) {
        console.error("Solr reindex failed:", solrError);
      }
    }

    res.json({
      success: true,
      message: `Updated ${results.length} product(s)`,
      updated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Batch update error:", error);
    res.status(500).json({
      success: false,
      error: "Batch update failed",
      message: error.message
    });
  }
});

/**
 * POST /api/products/batch-add-language
 * Add translations for a specific language to multiple products
 */
router.post("/batch-add-language", async (req: Request, res: Response) => {
  try {
    const { languageCode, translations, reindexSolr = true } = req.body;

    if (!languageCode) {
      return res.status(400).json({
        success: false,
        error: "languageCode is required"
      });
    }

    if (!Array.isArray(translations) || translations.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of translations"
      });
    }

    // Verify language is enabled
    const enabledLanguages = await getEnabledLanguages();
    const language = enabledLanguages.find(l => l.code === languageCode);

    if (!language) {
      return res.status(400).json({
        success: false,
        error: `Language '${languageCode}' is not enabled`
      });
    }

    const results = [];
    const errors = [];

    for (const translation of translations) {
      const { sku, name, description, features, seoTitle, seoDescription } = translation;

      if (!sku) {
        errors.push({ sku: "unknown", error: "SKU is required" });
        continue;
      }

      try {
        const product = await ProductModel.findOne({ sku });

        if (!product) {
          errors.push({ sku, error: "Product not found" });
          continue;
        }

        // Add translations
        if (name) {
          if (!product.name) product.name = {};
          product.name[languageCode] = name;
        }

        if (description) {
          if (!product.description) product.description = {};
          product.description[languageCode] = description;
        }

        if (features) {
          if (!product.features) product.features = {};
          product.features[languageCode] = features;
        }

        if (seoTitle) {
          if (!product.seoTitle) product.seoTitle = {};
          product.seoTitle[languageCode] = seoTitle;
        }

        if (seoDescription) {
          if (!product.seoDescription) product.seoDescription = {};
          product.seoDescription[languageCode] = seoDescription;
        }

        await product.save();

        results.push({
          sku,
          _id: product._id,
          language: languageCode,
          fieldsUpdated: [
            name && "name",
            description && "description",
            features && "features",
            seoTitle && "seoTitle",
            seoDescription && "seoDescription"
          ].filter(Boolean)
        });
      } catch (error: any) {
        errors.push({ sku, error: error.message });
      }
    }

    // Reindex to Solr
    if (reindexSolr && results.length > 0) {
      try {
        await reindexProductsToSolr(results.map(r => r.sku));
      } catch (solrError: any) {
        console.error("Solr reindex failed:", solrError);
      }
    }

    res.json({
      success: true,
      message: `Added ${languageCode} translations to ${results.length} product(s)`,
      language: languageCode,
      updated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Batch add language error:", error);
    res.status(500).json({
      success: false,
      error: "Batch language addition failed",
      message: error.message
    });
  }
});

/**
 * POST /api/products/batch-remove-language
 * Remove translations for a specific language from multiple products
 */
router.post("/batch-remove-language", async (req: Request, res: Response) => {
  try {
    const { languageCode, skus, reindexSolr = true } = req.body;

    if (!languageCode) {
      return res.status(400).json({
        success: false,
        error: "languageCode is required"
      });
    }

    if (languageCode === "it") {
      return res.status(400).json({
        success: false,
        error: "Cannot remove Italian translations - it's the required default language"
      });
    }

    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of SKUs"
      });
    }

    const results = [];
    const errors = [];

    for (const sku of skus) {
      try {
        const product = await ProductModel.findOne({ sku });

        if (!product) {
          errors.push({ sku, error: "Product not found" });
          continue;
        }

        // Remove translations
        const fieldsRemoved = [];

        if (product.name && product.name[languageCode]) {
          delete product.name[languageCode];
          fieldsRemoved.push("name");
        }

        if (product.description && product.description[languageCode]) {
          delete product.description[languageCode];
          fieldsRemoved.push("description");
        }

        if (product.features && product.features[languageCode]) {
          delete product.features[languageCode];
          fieldsRemoved.push("features");
        }

        if (product.seoTitle && product.seoTitle[languageCode]) {
          delete product.seoTitle[languageCode];
          fieldsRemoved.push("seoTitle");
        }

        if (product.seoDescription && product.seoDescription[languageCode]) {
          delete product.seoDescription[languageCode];
          fieldsRemoved.push("seoDescription");
        }

        if (fieldsRemoved.length > 0) {
          await product.save();

          results.push({
            sku,
            _id: product._id,
            language: languageCode,
            fieldsRemoved
          });
        }
      } catch (error: any) {
        errors.push({ sku, error: error.message });
      }
    }

    // Reindex to Solr
    if (reindexSolr && results.length > 0) {
      try {
        await reindexProductsToSolr(results.map(r => r.sku));
      } catch (solrError: any) {
        console.error("Solr reindex failed:", solrError);
      }
    }

    res.json({
      success: true,
      message: `Removed ${languageCode} translations from ${results.length} product(s)`,
      language: languageCode,
      updated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Batch remove language error:", error);
    res.status(500).json({
      success: false,
      error: "Batch language removal failed",
      message: error.message
    });
  }
});

/**
 * POST /api/products/batch-import
 * Import multiple products from JSON array
 */
router.post("/batch-import", async (req: Request, res: Response) => {
  try {
    const { products, updateExisting = false, reindexSolr = true } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of products"
      });
    }

    const results = {
      created: [],
      updated: [],
      failed: []
    };

    for (const productData of products) {
      const { sku } = productData;

      if (!sku) {
        results.failed.push({
          data: productData,
          error: "SKU is required"
        });
        continue;
      }

      try {
        const existing = await ProductModel.findOne({ sku });

        if (existing) {
          if (updateExisting) {
            Object.assign(existing, productData);
            await existing.save();

            results.updated.push({
              sku,
              _id: existing._id
            });
          } else {
            results.failed.push({
              sku,
              error: "Product already exists (use updateExisting: true to update)"
            });
          }
        } else {
          const newProduct = new ProductModel(productData);
          await newProduct.save();

          results.created.push({
            sku,
            _id: newProduct._id
          });
        }
      } catch (error: any) {
        results.failed.push({
          sku,
          error: error.message
        });
      }
    }

    // Reindex to Solr
    if (reindexSolr && (results.created.length > 0 || results.updated.length > 0)) {
      try {
        const skusToReindex = [
          ...results.created.map(r => r.sku),
          ...results.updated.map(r => r.sku)
        ];
        await reindexProductsToSolr(skusToReindex);
      } catch (solrError: any) {
        console.error("Solr reindex failed:", solrError);
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.created.length + results.updated.length} product(s)`,
      created: results.created.length,
      updated: results.updated.length,
      failed: results.failed.length,
      results
    });
  } catch (error: any) {
    console.error("Batch import error:", error);
    res.status(500).json({
      success: false,
      error: "Batch import failed",
      message: error.message
    });
  }
});

// ============================================================================
// Reindexing Endpoints
// ============================================================================

/**
 * POST /api/products/reindex
 * Reindex products to Solr
 */
router.post("/reindex", async (req: Request, res: Response) => {
  try {
    const { skus, all = false, limit = 1000 } = req.body;

    let products;

    if (all) {
      // Reindex all products
      products = await ProductModel.find({ isPublished: true })
        .limit(Number(limit))
        .lean();
    } else if (Array.isArray(skus) && skus.length > 0) {
      // Reindex specific products
      products = await ProductModel.find({ sku: { $in: skus }, isPublished: true })
        .lean();
    } else {
      return res.status(400).json({
        success: false,
        error: "Please provide 'skus' array or set 'all: true'"
      });
    }

    if (products.length === 0) {
      return res.json({
        success: true,
        message: "No products to reindex",
        indexed: 0
      });
    }

    // Convert products to Solr documents
    const solrDocuments = await convertProductsToSolrDocs(products);

    // Index to Solr
    const solrUrl = `http://${projectConfig.solrCore}:8983/solr/${projectConfig.solrCore}/update?commit=true`;
    await axios.post(solrUrl, solrDocuments, {
      headers: { "Content-Type": "application/json" }
    });

    res.json({
      success: true,
      message: `Reindexed ${products.length} product(s) to Solr`,
      indexed: products.length
    });
  } catch (error: any) {
    console.error("Reindex error:", error);
    res.status(500).json({
      success: false,
      error: "Reindex failed",
      message: error.message
    });
  }
});

/**
 * GET /api/products/batch-status
 * Get batch operation status and statistics
 */
router.get("/batch-status", async (req: Request, res: Response) => {
  try {
    const [
      total,
      published,
      draft,
      archived,
      withoutTranslations
    ] = await Promise.all([
      ProductModel.countDocuments(),
      ProductModel.countDocuments({ isPublished: true }),
      ProductModel.countDocuments({ status: "draft" }),
      ProductModel.countDocuments({ status: "archived" }),
      ProductModel.countDocuments({
        $or: [
          { "name.it": { $exists: false } },
          { "description.it": { $exists: false } }
        ]
      })
    ]);

    // Count products per language
    const enabledLanguages = await getEnabledLanguages();
    const languageCoverage = {};

    for (const lang of enabledLanguages) {
      const withLang = await ProductModel.countDocuments({
        [`name.${lang.code}`]: { $exists: true }
      });

      languageCoverage[lang.code] = {
        count: withLang,
        percentage: total > 0 ? Math.round((withLang / total) * 100) : 0
      };
    }

    res.json({
      success: true,
      stats: {
        total,
        published,
        draft,
        archived,
        withoutTranslations,
        languageCoverage
      }
    });
  } catch (error: any) {
    console.error("Batch status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get batch status",
      message: error.message
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reindex products to Solr
 */
async function reindexProductsToSolr(skus: string[]): Promise<void> {
  const products = await ProductModel.find({
    sku: { $in: skus },
    isPublished: true
  }).lean();

  if (products.length === 0) {
    return;
  }

  const solrDocuments = await convertProductsToSolrDocs(products);

  const solrUrl = `http://${process.env.SOLR_HOST || "localhost"}:${process.env.SOLR_PORT || 8983}/solr/${projectConfig.solrCore}/update?commit=true`;

  await axios.post(solrUrl, solrDocuments, {
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Convert products to Solr documents
 */
async function convertProductsToSolrDocs(products: any[]): Promise<any[]> {
  const enabledLanguages = await getEnabledLanguages();

  return products.map(product => {
    const doc: any = {
      id: product.sku,
      sku: product.sku,
      category_id: product.category?.id,
      category_name: product.category?.name,
      brand_id: product.brand?.id,
      brand_name: product.brand?.name,
      price: product.price,
      original_price: product.originalPrice,
      cost: product.cost,
      stock_status: product.stock?.status,
      quantity: product.stock?.quantity,
      status: product.status,
      is_published: product.isPublished,
      visibility: product.visibility,
      is_featured: product.isFeatured,
      is_bestseller: product.isBestseller,
      is_new: product.isNew,
      is_on_sale: product.isOnSale,
      rating_average: product.rating?.average,
      rating_count: product.rating?.count,
      view_count: product.analytics?.viewCount,
      order_count: product.analytics?.orderCount,
      discount_percentage: product.discountPercentage,
      created_at: product.createdAt,
      updated_at: product.updatedAt
    };

    // Add multilingual fields
    for (const lang of enabledLanguages) {
      const code = lang.code;

      if (product.name && product.name[code]) {
        doc[`name_text_${code}`] = product.name[code];
      }

      if (product.description && product.description[code]) {
        doc[`description_text_${code}`] = product.description[code];
      }

      if (product.features && product.features[code]) {
        doc[`features_text_${code}`] = product.features[code];
      }

      if (product.seoTitle && product.seoTitle[code]) {
        doc[`seo_title_text_${code}`] = product.seoTitle[code];
      }

      if (product.seoDescription && product.seoDescription[code]) {
        doc[`seo_description_text_${code}`] = product.seoDescription[code];
      }
    }

    return doc;
  });
}

export default router;
