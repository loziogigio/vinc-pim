import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportSourceModel } from "@/lib/db/models/import-source";
import { ImportJobModel } from "@/lib/db/models/import-job";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { LanguageModel } from "@/lib/db/models/language";
import { syncQueue } from "@/lib/queue/queues";
import {
  calculateCompletenessScore,
  findCriticalIssues,
} from "@/lib/pim/scorer";
import {
  checkAutoPublishEligibility,
  mergeWithLockedFields,
} from "@/lib/pim/auto-publish";
import { projectConfig } from "@/config/project.config";

/**
 * Multilingual fields that should have language suffixes
 */
const MULTILINGUAL_FIELDS = [
  "name",
  "description",
  "short_description",
  "features",
  "specifications",
  "meta_title",
  "meta_description",
  "keywords",
];

/**
 * Apply default language to multilingual fields
 * Converts plain strings to {lang: value} objects
 */
function applyDefaultLanguageToData(data: any): void {
  const defaultLang = projectConfig.defaultLanguage;

  for (const field of MULTILINGUAL_FIELDS) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
      const isLanguageObject = typeof data[field] === "object" &&
                                !Array.isArray(data[field]) &&
                                data[field] !== null;

      if (!isLanguageObject) {
        const plainValue = data[field];
        data[field] = {
          [defaultLang]: plainValue
        };
      }
    }
  }
}

/**
 * POST /api/b2b/pim/import/api
 * Import products directly via API request (JSON payload)
 *
 * Example request body:
 * {
 *   "source_id": "api-source-1",
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
 */
export async function POST(req: NextRequest) {
  try {
    // TODO: Re-enable authentication
    // const session = await getB2BSession();
    // if (!session || session.role !== "admin") {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await connectToDatabase();

    const body = await req.json();
    const { source_id, products, batch_id, batch_metadata, channel_metadata } = body;

    console.log('📦 Request params:', {
      source_id,
      batch_id,
      batch_metadata,
      channel_metadata,
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
        applyDefaultLanguageToData(mappedData);

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

        // Merge with locked fields if product exists
        let finalProductData = mappedData;
        if (latestProduct && latestProduct.locked_fields.length > 0) {
          finalProductData = mergeWithLockedFields(latestProduct, mappedData);
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

        console.log(`🔍 Product ${entity_code}`);
        console.log(`   batch_id received:`, batch_id);
        console.log(`   batch_metadata received:`, JSON.stringify(batch_metadata));
        console.log(`   productSource:`, JSON.stringify(productSource));
        console.log(`   finalProductData.source:`, JSON.stringify(finalProductData.source || 'undefined'));

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
              tenant_id: process.env.VINC_TENANT_ID || 'default',
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
