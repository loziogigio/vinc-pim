import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { syncQueue } from "@/lib/queue/queues";
import {
  calculateCompletenessScore,
  findCriticalIssues,
} from "@/lib/pim/scorer";
import {
  checkAutoPublishEligibility,
  mergeWithLockedFields,
} from "@/lib/pim/auto-publish";
import { projectConfig, MULTILINGUAL_FIELDS } from "@/config/project.config";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { autoProvisionCatalogEntities } from "@/lib/services/pim-catalog-autoprovision.service";

/**
 * Check if an object is already in multilingual format (has language keys at root level)
 * @param obj - The object to check
 * @param languageCodes - Array of valid language codes from database
 */
function isMultilingualObject(obj: any, languageCodes: string[]): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }
  const keys = Object.keys(obj);

  // If no languages are configured in database, use common language codes as fallback
  const validCodes = languageCodes.length > 0
    ? languageCodes
    : ['it', 'en', 'de', 'fr', 'es', 'pt', 'nl', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg'];

  // Check if all keys are language codes (e.g., { it: ..., en: ... })
  // Also check that keys are 2-letter codes to avoid false positives
  return keys.length > 0 &&
         keys.every(key => key.length === 2 && validCodes.includes(key));
}

/**
 * Apply default language to multilingual fields
 * Converts plain strings/objects to {lang: value} format
 * @param data - Product data to transform
 * @param languageCodes - Array of valid language codes from database
 */
function applyDefaultLanguageToData(data: any, languageCodes: string[]): void {
  const defaultLang = projectConfig().defaultLanguage;

  for (const field of MULTILINGUAL_FIELDS) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
      // Check if already in multilingual format (keys are language codes)
      if (!isMultilingualObject(data[field], languageCodes)) {
        const plainValue = data[field];
        data[field] = {
          [defaultLang]: plainValue
        };
      }
    }
  }
}

/**
 * Merge media arrays by type.
 * For each media type present in incoming: replace all existing items of that type.
 * For types NOT in incoming: keep existing items untouched.
 * Recalculates positions after merge.
 */
function mergeMediaByType(existingMedia: any[], incomingMedia: any[]): any[] {
  // Group incoming media by type
  const incomingTypes = new Set(incomingMedia.map((m: any) => m.type));

  // Keep existing items whose type is NOT in the incoming data
  const preserved = existingMedia.filter((m: any) => !incomingTypes.has(m.type));

  // Combine: preserved existing + all incoming
  const merged = [...preserved, ...incomingMedia];

  // Recalculate positions
  return merged.map((item, index) => ({ ...item, position: index }));
}

/**
 * Deep merge two objects, with source values overriding target values
 * Arrays are replaced, not merged
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    // Skip undefined/null source values (don't override with empty)
    if (sourceValue === undefined || sourceValue === null) {
      continue;
    }

    // If source value is an object (but not array, Date, or ObjectId)
    if (
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      !(sourceValue instanceof Date) &&
      sourceValue.constructor === Object &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue) &&
      !(targetValue instanceof Date) &&
      targetValue.constructor === Object
    ) {
      // Recursively merge objects
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      // Replace value (including arrays)
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * POST /api/b2b/pim/import/api
 * Import products directly via API request (JSON payload)
 *
 * Example request body:
 * {
 *   "source_id": "api-source-1",
 *   "merge_mode": "partial",  // "replace" (default) or "partial" for delta updates
 *   "products": [
 *     {
 *       "entity_code": "SKU001",
 *       "sku": "SKU001",
 *       "name": "Product Name",
 *       "description": "Product description",
 *       "price": 29.99,
 *       "category": "Electronics",
 *       "brand": "BrandName",
 *       "stock": 100
 *     }
 *   ],
 *   "batch_id": "batch_123",
 *   "batch_metadata": {
 *     "batch_id": "batch_123",
 *     "batch_part": 1,
 *     "batch_total_parts": 3,
 *     "batch_total_items": 300
 *   },
 *   "channel_metadata": {
 *     "b2b": { "tenant_id": "tenant_001" },
 *     "b2c": { "store_id": "store_001" }
 *   }
 * }
 *
 * merge_mode options:
 * - "replace" (default): New data replaces existing product entirely
 * - "partial": New data is merged with existing product (delta updates)
 */
export async function POST(req: NextRequest) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantId: string | undefined;
    let tenantDb: string;

    if (authMethod === "api-key") {
      // Verify API key and secret (requires "import" permission)
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "import");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
      tenantId = apiKeyResult.tenantId;
    } else {
      // Require valid session authentication (no env var fallback)
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
      tenantId = session.tenantId;
    }

    // Get models bound to the correct tenant connection
    const {
      ImportSource: ImportSourceModel,
      ImportJob: ImportJobModel,
      PIMProduct: PIMProductModel,
      Language: LanguageModel,
      Brand: BrandModel,
      Category: CategoryModel,
      ProductType: ProductTypeModel,
    } = await connectWithModels(tenantDb);

    // Fetch language codes from database for multilingual detection
    const languages = await LanguageModel.find({}, { code: 1 }).lean();
    const languageCodes = languages.map((l: { code: string }) => l.code);

    const body = await req.json();
    const { source_id, products, batch_id, batch_metadata, channel_metadata, merge_mode = 'replace' } = body;

    console.log('📦 Request params:', {
      source_id,
      batch_id,
      batch_metadata,
      channel_metadata,
      merge_mode,
      product_count: products?.length
    });

    // Validate request
    if (!source_id) {
      return NextResponse.json(
        { error: "Missing source_id in request body" },
        { status: 400 }
      );
    }

    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        { error: "Missing or invalid products array in request body" },
        { status: 400 }
      );
    }

    if (products.length === 0) {
      return NextResponse.json(
        { error: "Products array is empty" },
        { status: 400 }
      );
    }

    if (products.length > 10000) {
      return NextResponse.json(
        { error: "Too many products. Maximum 10,000 per request" },
        { status: 400 }
      );
    }

    // Verify source exists
    console.log(`🔍 Looking for source: ${source_id}`);
    const source = await ImportSourceModel.findOne({ source_id });
    console.log(`📦 Source found:`, source ? `${source.source_name}` : "null");

    if (!source) {
      // List all sources for debugging
      const allSources = await ImportSourceModel.find({}).limit(10);
      console.log(`📋 Available sources in DB:`, allSources.map(s => s.source_id));
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Create import job
    const jobId = `api_import_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const job = await ImportJobModel.create({
      // No wholesaler_id - database provides isolation
      source_id: source_id,
      job_id: jobId,
      file_name: `API Import - ${products.length} products`,
      file_size: JSON.stringify(products).length,
      status: "processing",
      total_rows: products.length,
      started_at: new Date(),
    });

    console.log(`\n🔄 Processing API import: ${jobId}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Source: ${source_id}`);

    // Process products
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let autoPublished = 0;
    const errors: any[] = [];
    const successfulEntityCodes: string[] = []; // Track for Solr sync
    let debugProductSource: any = null; // For debugging first product
    const catalogStats = { brandsCreated: 0, productTypesCreated: 0, categoriesCreated: 0 };

    for (const productData of products) {
      try {
        // Apply field mappings from source configuration
        let mappedData: any = {};

        if (source.field_mappings && Object.keys(source.field_mappings).length > 0) {
          // Apply field mappings
          for (const [sourceField, targetField] of Object.entries(source.field_mappings)) {
            if (productData[sourceField] !== undefined) {
              mappedData[targetField as string] = productData[sourceField];
            }
          }

          // Add extra fields that aren't in the mapping
          for (const [key, value] of Object.entries(productData)) {
            if (!source.field_mappings[key] && mappedData[key] === undefined) {
              mappedData[key] = value;
            }
          }
        } else {
          // No field mappings, use data as-is (1:1 mapping)
          mappedData = { ...productData };
        }

        // Apply default language to multilingual fields (convert plain strings to {lang: value})
        applyDefaultLanguageToData(mappedData, languageCodes);

        const entity_code = mappedData.entity_code || mappedData.sku;

        if (!entity_code) {
          errors.push({
            row: processed + 1,
            entity_code: "",
            error: "Missing entity_code or sku after field mapping",
            raw_data: productData, // Capture the raw data that failed
          });
          failed++;
          processed++;
          continue;
        }

        // Find latest version for this product
        const latestProduct = await PIMProductModel.findOne({
          // No wholesaler_id - database provides isolation
          entity_code,
          isCurrent: true,
        }).sort({ version: -1 });

        const newVersion = latestProduct ? latestProduct.version + 1 : 1;

        // Merge with existing product data based on merge_mode
        let finalProductData = mappedData;

        if (latestProduct) {
          if (merge_mode === 'partial') {
            // Partial update: merge incoming data with existing product data
            // Get existing product data (exclude PIM metadata fields)
            const existingData = latestProduct.toObject();
            const pimMetaFields = [
              '_id', '__v', 'version', 'isCurrent', 'isCurrentPublished',
              'status', 'published_at', 'source', 'completeness_score',
              'critical_issues', 'auto_publish_eligible', 'auto_publish_reason',
              'analytics', 'locked_fields', 'manually_edited', 'edited_by',
              'edited_at', 'created_at', 'updated_at'
            ];

            // Remove PIM metadata from existing data
            for (const field of pimMetaFields) {
              delete existingData[field];
            }

            // Deep merge: existing data + incoming data (incoming wins)
            // Temporarily remove images/media from both sides — handle them separately
            const existingImages = existingData.images || [];
            const existingMediaArr = existingData.media || [];
            const incomingImages = mappedData.images;
            const incomingMediaArr = mappedData.media;
            delete existingData.images;
            delete existingData.media;
            const mappedDataForMerge = { ...mappedData };
            delete mappedDataForMerge.images;
            delete mappedDataForMerge.media;

            finalProductData = deepMerge(existingData, mappedDataForMerge);

            // images: if incoming has images, replace all. Otherwise keep existing.
            if (incomingImages && incomingImages.length > 0) {
              finalProductData.images = incomingImages;
            } else {
              finalProductData.images = existingImages;
            }

            // media: merge by type — replace only same-type items, preserve others
            if (incomingMediaArr && incomingMediaArr.length > 0) {
              finalProductData.media = mergeMediaByType(existingMediaArr, incomingMediaArr);
            } else {
              finalProductData.media = existingMediaArr;
            }

            console.log(`   ℹ️ Partial merge: keeping existing data, media merged by type`);
          }

          // Also apply locked fields protection
          if (latestProduct.locked_fields.length > 0) {
            finalProductData = mergeWithLockedFields(latestProduct, finalProductData);
          }
        }

        // Calculate quality metrics
        const completenessScore = calculateCompletenessScore(finalProductData);
        const criticalIssues = findCriticalIssues(finalProductData);

        // Check auto-publish eligibility
        const autoPublishResult = checkAutoPublishEligibility(
          { ...finalProductData, completeness_score: completenessScore } as any,
          source
        );

        // Determine initial status
        const status = autoPublishResult.eligible ? "published" : "draft";
        const published_at = autoPublishResult.eligible ? new Date() : undefined;

        if (autoPublishResult.eligible) {
          autoPublished++;
        }

        // Mark old versions as not current
        if (latestProduct) {
          await PIMProductModel.updateMany(
            {
              // No wholesaler_id - database provides isolation
              entity_code,
              isCurrent: true
            },
            { isCurrent: false, isCurrentPublished: false }
          );
        }

        // Create new version
        const productSource: any = {
          source_id: source.source_id,
          source_name: source.source_name,
          imported_at: new Date(),
        };

        if (batch_id) {
          productSource.batch_id = batch_id;
        }

        if (batch_metadata) {
          productSource.batch_metadata = batch_metadata;
        }

        // Capture first product source for debugging
        if (!debugProductSource) {
          debugProductSource = JSON.parse(JSON.stringify(productSource));
        }

        await PIMProductModel.create({
          // No wholesaler_id - database provides isolation
          ...finalProductData,
          entity_code,
          sku: finalProductData.sku || entity_code,
          version: newVersion,
          isCurrent: true,
          isCurrentPublished: autoPublishResult.eligible,
          status,
          published_at,
          source: productSource,
          completeness_score: completenessScore,
          critical_issues: criticalIssues,
          auto_publish_eligible: autoPublishResult.eligible,
          auto_publish_reason: autoPublishResult.reason,
          analytics: {
            views_30d: 0,
            clicks_30d: 0,
            add_to_cart_30d: 0,
            conversions_30d: 0,
            priority_score: 0,
            last_synced_at: new Date(),
          },
        });

        successfulEntityCodes.push(entity_code);
        successful++;

        // Auto-provision standalone Brand / ProductType / Category records
        // from the embedded data on this product (idempotent: insert-if-missing).
        try {
          const provStats = await autoProvisionCatalogEntities({
            BrandModel: BrandModel as any,
            ProductTypeModel: ProductTypeModel as any,
            CategoryModel: CategoryModel as any,
            brand: finalProductData.brand,
            product_type: finalProductData.product_type,
            channel_categories: finalProductData.channel_categories,
          });
          catalogStats.brandsCreated += provStats.brandsCreated;
          catalogStats.productTypesCreated += provStats.productTypesCreated;
          catalogStats.categoriesCreated += provStats.categoriesCreated;
        } catch (provErr: any) {
          // Don't fail the import if auto-provisioning the catalog hits an issue.
          console.error(`⚠️ Catalog auto-provision failed for ${entity_code}: ${provErr.message}`);
        }
      } catch (error: any) {
        errors.push({
          row: processed + 1,
          entity_code: productData.entity_code || productData.sku || "",
          error: error.message,
          raw_data: productData, // Capture the raw data that caused the error
        });
        failed++;
      }

      processed++;
    }

    // Mark job as completed
    const completedAt = new Date();
    const startedAt = job.started_at!;
    const durationSeconds = (completedAt.getTime() - startedAt.getTime()) / 1000;

    await ImportJobModel.findOneAndUpdate(
      { job_id: jobId },
      {
        status: "completed",
        processed_rows: processed,
        successful_rows: successful,
        failed_rows: failed,
        auto_published_count: autoPublished,
        import_errors: errors.slice(0, 1000), // Limit to first 1000 errors
        completed_at: completedAt,
        duration_seconds: durationSeconds,
      }
    );

    // Update source stats
    await ImportSourceModel.findOneAndUpdate(
      { source_id },
      {
        $inc: { "stats.total_imports": 1, "stats.total_products": successful },
        "stats.last_import_at": completedAt,
        "stats.last_import_status": failed > 0 ? "partial" : "success",
      }
    );

    console.log(`✅ API import completed: ${successful} successful, ${failed} failed`);

    // ========== QUEUE SOLR SYNC ==========
    // Queue batch sync jobs if Solr is enabled and language has searchEnabled=true
    let syncQueued = 0;
    if (successfulEntityCodes.length > 0 && process.env.SOLR_ENABLED === 'true') {
      try {
        // Get default language (or first enabled language with searchEnabled)
        const defaultLanguage = await LanguageModel.findOne({
          isDefault: true,
          isEnabled: true,
          searchEnabled: true
        });

        if (defaultLanguage) {
          console.log(`\n📤 Queuing batch Solr sync for ${successfulEntityCodes.length} products (language: ${defaultLanguage.code})`);

          // Batch the products (50 per batch for optimal performance)
          const SYNC_BATCH_SIZE = 50;
          const batchCount = Math.ceil(successfulEntityCodes.length / SYNC_BATCH_SIZE);

          for (let i = 0; i < successfulEntityCodes.length; i += SYNC_BATCH_SIZE) {
            const batchIds = successfulEntityCodes.slice(i, i + SYNC_BATCH_SIZE);
            const batchNumber = Math.floor(i / SYNC_BATCH_SIZE) + 1;

            await syncQueue.add('bulk-sync-batch', {
              product_id: `batch-${jobId}-${batchNumber}`,
              product_ids: batchIds,
              operation: 'bulk-sync',
              channels: ['solr'],
              tenant_id: tenantId,
              priority: 'high',
            }, {
              priority: 1, // High priority for search indexing
            });

            console.log(`   ✓ Queued batch ${batchNumber}/${batchCount} (${batchIds.length} products)`);
          }

          syncQueued = batchCount;
          console.log(`✅ Queued ${batchCount} batch sync jobs for Solr indexing`);
        } else {
          console.log(`⚠️ No search-enabled default language found - skipping Solr sync`);
        }
      } catch (syncError: any) {
        console.error(`⚠️ Failed to queue batch sync: ${syncError.message}`);
        // Don't fail the import if sync queueing fails
      }
    } else if (successfulEntityCodes.length > 0) {
      console.log(`ℹ️ Solr sync skipped (SOLR_ENABLED=${process.env.SOLR_ENABLED})`);
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      debug: {
        batch_id,
        batch_metadata,
        channel_metadata, // Placeholder for future implementation
        first_product_source: debugProductSource,
      },
      summary: {
        total: processed,
        successful,
        failed,
        auto_published: autoPublished,
        duration_seconds: durationSeconds,
        sync_batches_queued: syncQueued,
        brands_created: catalogStats.brandsCreated,
        product_types_created: catalogStats.productTypesCreated,
        categories_created: catalogStats.categoriesCreated,
      },
      errors: errors.slice(0, 100), // Return first 100 errors
      message: `Imported ${successful} of ${processed} products successfully${syncQueued > 0 ? `, queued ${syncQueued} Solr sync batches` : ''}`,
    });
  } catch (error: any) {
    console.error("Error processing API import:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
