/**
 * Enable Language API Route
 * POST /api/admin/languages/:code/enable
 * Supports both session auth and API key auth
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { refreshLanguageCache } from "@/services/language.service";
import { addLanguageFieldsToSolr } from "@/services/solr-schema.service";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Check for API key authentication first
    const authMethod = request.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(request);
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { success: false, error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    // Get models bound to the correct tenant connection
    const { Language: LanguageModel } = await connectWithModels(tenantDb);

    const { code } = await params;
    const body = await request.json();
    const { syncSolr = true } = body;

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

    // Check if already enabled
    if (language.isEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: `Language '${code}' is already enabled`
        },
        { status: 400 }
      );
    }

    // Enable language
    language.isEnabled = true;
    await language.save();

    // Refresh cache
    await refreshLanguageCache();

    const result: any = {
      success: true,
      message: `Language '${code}' (${language.name}) enabled successfully`,
      language: {
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        isEnabled: language.isEnabled
      },
      solrSync: null
    };

    // Sync Solr schema
    if (syncSolr) {
      try {
        console.log(`🔧 Syncing Solr schema for language: ${code}`);

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
        console.error(`❌ Solr sync failed for ${code}:`, solrError);
        result.solrSync = {
          success: false,
          error: "Failed to update Solr schema",
          message: solrError.message
        };
        result.warning = "Language enabled in database but Solr schema update failed";
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error enabling language:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to enable language",
        message: error.message
      },
      { status: 500 }
    );
  }
}
