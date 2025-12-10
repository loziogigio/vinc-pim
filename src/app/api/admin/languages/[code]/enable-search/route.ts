/**
 * Enable Search Indexing for Language API Route
 * POST /api/admin/languages/:code/enable-search
 *
 * Enables search engine indexing for a language:
 * - Updates Solr schema with language-specific analyzers
 * - Queues indexing jobs for all products
 * - Sets searchEnabled flag
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { LanguageModel } from "@/lib/db/models/language";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { refreshLanguageCache } from "@/services/language.service";
import { addLanguageFieldsToSolr, ensureBaseFields } from "@/services/solr-schema.service";
import { syncQueue } from "@/lib/queue/queues";
import { projectConfig, ensureSolrCore } from "@/config/project.config";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await connectToDatabase();

    const { code } = await params;

    // Find language
    const language = await LanguageModel.findOne({ code });
    if (!language) {
      return NextResponse.json(
        {
          success: false,
          error: `Language '${code}' not found`
        },
        { status: 404 }
      );
    }

    // Check if language is enabled for data entry
    if (!language.isEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: `Language '${code}' must be enabled for data entry before enabling search indexing`
        },
        { status: 400 }
      );
    }

    // Check if already enabled for search
    if (language.searchEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: `Search indexing for '${code}' is already enabled`
        },
        { status: 400 }
      );
    }

    // Enable search indexing
    language.searchEnabled = true;
    await language.save();

    // Refresh cache
    await refreshLanguageCache();

    const result: any = {
      success: true,
      message: `Search indexing enabled for ${language.name} (${code})`,
      language: {
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        isEnabled: language.isEnabled,
        searchEnabled: language.searchEnabled
      },
      solrSync: null,
      jobQueued: false
    };

    // Ensure Solr core exists (create if needed)
    try {
      const config = projectConfig();
      console.log(`🔍 Ensuring Solr core exists: ${config.solrCore}`);
      await ensureSolrCore(config);
    } catch (coreError: any) {
      console.error(`❌ Failed to ensure Solr core exists:`, coreError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create or verify Solr core",
          message: coreError.message
        },
        { status: 500 }
      );
    }

    // Update Solr schema
    try {
      console.log(`🔍 Enabling search indexing for language: ${code}`);

      // Ensure base non-language fields exist first
      await ensureBaseFields();

      // Add field type and fields to Solr
      await addLanguageFieldsToSolr(language);

      result.solrSync = {
        success: true,
        message: `Solr schema updated for ${code}`,
        fieldsAdded: [
          `name_text_${code}`,
          `description_text_${code}`,
          `features_text_${code}`,
          `seo_title_text_${code}`,
          `seo_description_text_${code}`
        ]
      };

      console.log(`✅ Solr schema updated successfully for ${code}`);
    } catch (solrError: any) {
      console.error(`❌ Solr schema update failed for ${code}:`, solrError);
      result.solrSync = {
        success: false,
        error: "Failed to update Solr schema",
        message: solrError.message
      };
      result.warning = "Search enabled in database but Solr schema update failed";
    }

    // Queue indexing jobs for all products
    try {
      console.log(`📋 Queueing Solr indexing jobs for language: ${code}`);

      // Get count of products with content in this language
      // A product has content in a language if it has name, description, or features in that language
      const productsWithContent = await PIMProductModel.countDocuments({
        isCurrent: true,
        $or: [
          { [`name.${code}`]: { $exists: true, $ne: "" } },
          { [`description.${code}`]: { $exists: true, $ne: "" } },
          { [`features.${code}`]: { $exists: true, $ne: [] } },
        ]
      });

      if (productsWithContent === 0) {
        console.log(`ℹ️  No products found with content in language: ${code}`);
        result.jobQueued = false;
        result.jobMessage = `No products with ${code.toUpperCase()} content to index`;
        return NextResponse.json(result);
      }

      // Queue a single bulk indexing job
      const job = await syncQueue.add(`index-language-${code}`, {
        operation: "bulk-index-language",
        language: code,
        productCount: productsWithContent,
        tenant_id: "default", // TODO: Get from request context
      }, {
        priority: 5, // Medium priority
        removeOnComplete: true,
        removeOnFail: false,
      });

      console.log(`✅ Queued indexing job ${job.id} for ${productsWithContent} products in ${code}`);

      result.jobQueued = true;
      result.jobId = job.id;
      result.jobMessage = `Queued indexing for ${productsWithContent} products in ${code.toUpperCase()}`;

    } catch (queueError: any) {
      console.error(`❌ Failed to queue indexing job for ${code}:`, queueError);
      result.jobQueued = false;
      result.jobMessage = `Failed to queue indexing job: ${queueError.message}`;
      result.warning = "Search enabled but indexing job could not be queued";
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error enabling search indexing:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to enable search indexing",
        message: error.message
      },
      { status: 500 }
    );
  }
}
