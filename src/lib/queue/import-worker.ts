/**
 * BullMQ Import Worker
 * Processes product import jobs in the background
 */

import { Worker, Job } from "bullmq";
import { connectToDatabase } from "../db/connection";
import { ImportSourceModel } from "../db/models/import-source";
import { ImportJobModel } from "../db/models/import-job";
import { PIMProductModel } from "../db/models/pim-product";
import { parseCSV, parseExcel, detectFileType } from "../pim/parser";
import {
  calculateCompletenessScore,
  findCriticalIssues,
} from "../pim/scorer";
import {
  checkAutoPublishEligibility,
  mergeWithLockedFields,
} from "../pim/auto-publish";

interface ImportJobData {
  job_id: string;
  source_id: string;
  wholesaler_id: string;
  file_url?: string; // CDN URL (for file imports)
  file_name?: string;
  api_config?: {
    endpoint: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    params?: Record<string, string>;
    auth_type?: "none" | "bearer" | "api_key" | "basic";
    auth_token?: string;
  };
  field_mappings?: Record<string, string>;
  auto_publish_enabled?: boolean;
  min_score_threshold?: number;
  required_fields?: string[];
  // Phase 3: Batch metadata
  batch_metadata?: {
    batch_id: string; // Unique ID for the entire batch
    batch_part: number; // Which part is this (1-based)
    batch_total_parts: number; // Total expected parts
    batch_total_items: number; // Total items across all parts
  };
}

/**
 * Process import job
 */
async function processImport(job: Job<ImportJobData>) {
  const { job_id, source_id, wholesaler_id, file_url, file_name, api_config } = job.data;

  const isApiImport = !!api_config;

  console.log(`\n🔄 Processing import job: ${job_id}`);
  console.log(`   Type: ${isApiImport ? 'API Import' : 'File Import'}`);
  console.log(`   Source: ${source_id}`);
  if (isApiImport) {
    console.log(`   API Endpoint: ${api_config.endpoint}`);
  } else {
    console.log(`   File: ${file_name}`);
    console.log(`   CDN URL: ${file_url}`);
  }

  await connectToDatabase();

  try {
    // ========== PHASE 3: HANDLE BATCH METADATA ==========
    const batchMetadata = job.data.batch_metadata;

    if (batchMetadata) {
      console.log(`📦 Batch ${batchMetadata.batch_id} - Part ${batchMetadata.batch_part}/${batchMetadata.batch_total_parts}`);

      // Validate batch part number
      if (batchMetadata.batch_part > batchMetadata.batch_total_parts) {
        throw new Error(
          `Invalid batch part: ${batchMetadata.batch_part} exceeds total ${batchMetadata.batch_total_parts}`
        );
      }
      if (batchMetadata.batch_part < 1) {
        throw new Error(`Invalid batch part: ${batchMetadata.batch_part} must be >= 1`);
      }
    }

    // Update job status with batch metadata
    await ImportJobModel.findOneAndUpdate(
      { job_id },
      {
        status: "processing",
        started_at: new Date(),
        ...(batchMetadata && {
          batch_id: batchMetadata.batch_id,
          batch_part: batchMetadata.batch_part,
          batch_total_parts: batchMetadata.batch_total_parts,
          batch_total_items: batchMetadata.batch_total_items,
        }),
      }
    );

    // Get source configuration
    const source = await ImportSourceModel.findOne({ source_id, wholesaler_id });
    if (!source) throw new Error(`Source not found: ${source_id}`);

    let rows;

    if (isApiImport) {
      // ========== API IMPORT ==========
      console.log(`📡 Fetching data from API: ${api_config.endpoint}`);

      // Build fetch options
      const fetchOptions: RequestInit = {
        method: api_config.method || 'GET',
        headers: api_config.headers || {},
      };

      // Add authentication if configured
      if (api_config.auth_type === 'bearer' && api_config.auth_token) {
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Authorization': `Bearer ${api_config.auth_token}`
        };
      } else if (api_config.auth_type === 'api_key' && api_config.auth_token) {
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'X-API-Key': api_config.auth_token
        };
      }

      // Fetch from API
      const response = await fetch(api_config.endpoint, fetchOptions);
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }

      const apiData = await response.json();
      console.log(`✅ API data fetched (${JSON.stringify(apiData).length} bytes)`);

      // Transform API data to rows format
      const dataArray = Array.isArray(apiData) ? apiData : [apiData];

      rows = dataArray.map((item: any) => {
        // Apply field mappings to transform API fields to PIM fields
        const mappedData: any = {};

        if (job.data.field_mappings) {
          Object.entries(job.data.field_mappings).forEach(([apiField, pimField]) => {
            if (item[apiField] !== undefined) {
              mappedData[pimField] = item[apiField];
            }
          });
        } else {
          // No mappings, use data as-is
          Object.assign(mappedData, item);
        }

        return {
          entity_code: mappedData.entity_code || mappedData.id || String(Math.random()),
          data: mappedData
        };
      });

      console.log(`✅ Transformed ${rows.length} items from API`);

    } else {
      // ========== FILE IMPORT ==========
      // Validate file URL
      if (!file_url) {
        throw new Error("No file URL provided. The job is missing the CDN file URL.");
      }

      // Fetch file from CDN
      console.log(`📥 Fetching file from CDN: ${file_url}`);

      const response = await fetch(file_url);
      if (!response.ok) {
        throw new Error(`CDN fetch failed with status ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer) {
        throw new Error("CDN response returned empty arrayBuffer");
      }

      const buffer = Buffer.from(arrayBuffer);
      console.log(`✅ File fetched from CDN (${buffer.length} bytes)`)

      // Parse file
      const fileType = detectFileType(buffer, file_name!);

      if (fileType === "excel") {
        rows = await parseExcel(buffer, source);
      } else if (fileType === "csv") {
        rows = await parseCSV(buffer, source);
      } else {
        throw new Error("Unsupported file type");
      }
    }

    // ========== PHASE 1: BATCH SIZE VALIDATION ==========
    const MAX_BATCH_SIZE = source.limits?.max_batch_size || 10000;
    const WARN_BATCH_SIZE = source.limits?.warn_batch_size || 5000;

    // Validate batch size
    if (rows.length > MAX_BATCH_SIZE) {
      throw new Error(
        `❌ Batch size ${rows.length.toLocaleString()} exceeds maximum allowed ${MAX_BATCH_SIZE.toLocaleString()}. ` +
        `Please split into smaller batches or contact support to increase the limit for this source.`
      );
    }

    // Warning for large batches
    if (rows.length > WARN_BATCH_SIZE) {
      console.warn(`⚠️ Large batch detected: ${rows.length.toLocaleString()} items (threshold: ${WARN_BATCH_SIZE.toLocaleString()})`);
      console.warn(`⚠️ Processing time estimated: ~${Math.ceil(rows.length / 100 * 0.1)} seconds`);
    }

    console.log(`📊 Batch size: ${rows.length.toLocaleString()} items (Max: ${MAX_BATCH_SIZE.toLocaleString()})`);

    // ========== PHASE 4: MONITORING METRICS ==========
    const metrics = {
      job_id,
      batch_id: batchMetadata?.batch_id,
      batch_part: batchMetadata?.batch_part,
      batch_size: rows.length,
      start_time: Date.now(),
      memory_start: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      chunk_count: Math.ceil(rows.length / (source.limits?.chunk_size || 100)),
      estimated_duration_seconds: Math.ceil(rows.length / 100 * 0.1),
    };

    console.log(`📈 Import Metrics:`, JSON.stringify({
      job_id: metrics.job_id,
      batch_id: metrics.batch_id,
      batch_part: metrics.batch_part,
      batch_size: metrics.batch_size,
      memory_mb: Math.round(metrics.memory_start),
      estimated_duration: `${metrics.estimated_duration_seconds}s`,
      chunk_count: metrics.chunk_count,
    }));

    // Update total rows
    await ImportJobModel.findOneAndUpdate({ job_id }, { total_rows: rows.length });

    // Process each row
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let autoPublished = 0;
    const errors: any[] = [];

    for (const row of rows) {
      try {
        const { entity_code, data } = row;

        if (!entity_code) {
          errors.push({
            row: processed + 1,
            entity_code: "",
            error: "Missing entity_code",
            raw_data: row.data, // Capture the raw data that failed
          });
          failed++;
          processed++;
          continue;
        }

        // Find latest version for this product
        const latestProduct = await PIMProductModel.findOne({
          wholesaler_id,
          entity_code,
          isCurrent: true,
        }).sort({ version: -1 });

        const newVersion = latestProduct ? latestProduct.version + 1 : 1;

        // Merge with locked fields if product exists
        let productData = data;
        if (latestProduct && latestProduct.locked_fields.length > 0) {
          productData = mergeWithLockedFields(latestProduct, data);
        }

        // Provide default values for required fields if missing
        if (!productData.image || !productData.image.id) {
          productData.image = {
            id: `placeholder-${entity_code}`,
            thumbnail: '/images/placeholder-product.jpg',
            original: '/images/placeholder-product.jpg',
          };
        }
        if (!productData.sku) {
          productData.sku = entity_code;
        }

        // Calculate quality metrics
        const completenessScore = calculateCompletenessScore(productData);
        const criticalIssues = findCriticalIssues(productData);

        // Check auto-publish eligibility
        const autoPublishResult = checkAutoPublishEligibility(
          { ...productData, completeness_score: completenessScore } as any,
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
            { wholesaler_id, entity_code, isCurrent: true },
            { isCurrent: false, isCurrentPublished: false }
          );
        }

        // Create new version
        await PIMProductModel.create({
          wholesaler_id,
          entity_code,
          sku: productData.sku || entity_code,
          version: newVersion,
          isCurrent: true,
          isCurrentPublished: autoPublishResult.eligible,
          status,
          published_at,
          source: {
            source_id: source.source_id,
            source_name: source.source_name,
            imported_at: new Date(),
            auto_publish_enabled: source.auto_publish_enabled,
            min_score_threshold: source.min_score_threshold,
            required_fields: source.required_fields,
          },
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
          ...productData,
        });

        successful++;
      } catch (error: any) {
        errors.push({
          row: processed + 1,
          entity_code: row.entity_code,
          error: error.message,
          raw_data: row.data, // Capture the raw data that caused the error
        });
        failed++;
      }

      processed++;

      // Update progress every 100 rows
      if (processed % 100 === 0) {
        await ImportJobModel.findOneAndUpdate(
          { job_id },
          {
            processed_rows: processed,
            successful_rows: successful,
            failed_rows: failed,
          }
        );

        // Update job progress
        await job.updateProgress((processed / rows.length) * 100);
      }
    }

    // Mark job as completed
    const completedAt = new Date();
    const startedAt = (await ImportJobModel.findOne({ job_id }))!.started_at!;
    const durationSeconds = (completedAt.getTime() - startedAt.getTime()) / 1000;

    await ImportJobModel.findOneAndUpdate(
      { job_id },
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

    // ========== PHASE 4: FINAL METRICS ==========
    const finalMetrics = {
      job_id,
      batch_id: batchMetadata?.batch_id,
      batch_part: batchMetadata?.batch_part,
      duration_seconds: durationSeconds,
      memory_end: process.memoryUsage().heapUsed / 1024 / 1024,
      memory_delta: (process.memoryUsage().heapUsed / 1024 / 1024) - metrics.memory_start,
      processed,
      successful,
      failed,
      auto_published: autoPublished,
      success_rate: processed > 0 ? ((successful / processed) * 100).toFixed(2) : 0,
      items_per_second: durationSeconds > 0 ? (processed / durationSeconds).toFixed(2) : 0,
    };

    console.log(`✅ Import Complete:`, JSON.stringify({
      job_id: finalMetrics.job_id,
      batch_id: finalMetrics.batch_id,
      batch_part: finalMetrics.batch_part,
      duration: `${finalMetrics.duration_seconds}s`,
      processed: finalMetrics.processed,
      successful: finalMetrics.successful,
      failed: finalMetrics.failed,
      success_rate: `${finalMetrics.success_rate}%`,
      throughput: `${finalMetrics.items_per_second} items/s`,
      memory_mb: Math.round(finalMetrics.memory_end),
    }));

    // Alert on high failure rate
    if (processed > 100 && (failed / processed) > 0.1) {
      console.error(`⚠️ HIGH FAILURE RATE: ${((failed / processed) * 100).toFixed(2)}% (${failed}/${processed} items)`);
    }

    // Alert on slow processing
    const expectedDuration = metrics.estimated_duration_seconds;
    if (durationSeconds > expectedDuration * 2) {
      console.warn(`⚠️ SLOW PROCESSING: ${durationSeconds}s (expected: ${expectedDuration}s, ${((durationSeconds / expectedDuration) * 100).toFixed(0)}% slower)`);
    }

    return { processed, successful, failed, autoPublished };
  } catch (error: any) {
    // Mark job as failed
    await ImportJobModel.findOneAndUpdate(
      { job_id },
      {
        status: "failed",
        completed_at: new Date(),
        import_errors: [{ row: 0, entity_code: "", error: error.message }],
      }
    );

    await ImportSourceModel.findOneAndUpdate(
      { source_id },
      { "stats.last_import_status": "failed" }
    );

    throw error;
  }
}

// Create and export the worker
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

// ========== PHASE 1: WORKER CONFIGURATION ==========
const WORKER_CONCURRENCY = parseInt(process.env.IMPORT_WORKER_CONCURRENCY || "2");
const RATE_LIMIT_MAX = parseInt(process.env.IMPORT_RATE_LIMIT_MAX || "5");
const RATE_LIMIT_DURATION = parseInt(process.env.IMPORT_RATE_LIMIT_DURATION_MS || "60000");
const JOB_TIMEOUT = parseInt(process.env.IMPORT_JOB_TIMEOUT_MINUTES || "60") * 60 * 1000;

console.log(`🔧 Import Worker Configuration:`);
console.log(`   Concurrency: ${WORKER_CONCURRENCY} jobs`);
console.log(`   Rate Limit: ${RATE_LIMIT_MAX} jobs per ${RATE_LIMIT_DURATION / 1000}s`);
console.log(`   Job Timeout: ${JOB_TIMEOUT / 60000} minutes`);

export const importWorker = new Worker("import-queue", processImport, {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  concurrency: WORKER_CONCURRENCY, // Process N imports simultaneously
  limiter: {
    max: RATE_LIMIT_MAX, // Maximum jobs per duration
    duration: RATE_LIMIT_DURATION, // Time window in milliseconds
  },
});

// Event listeners
importWorker.on("completed", (job) => {
  console.log(`✓ Import job ${job.id} completed`);
});

importWorker.on("failed", (job, err) => {
  console.error(`✗ Import job ${job?.id} failed:`, err);
});

importWorker.on("progress", (job, progress) => {
  console.log(`Import job ${job.id}: ${progress}%`);
});
