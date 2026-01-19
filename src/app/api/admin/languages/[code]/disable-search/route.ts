/**
 * Disable Search Indexing for Language API Route
 * POST /api/admin/languages/:code/disable-search
 * Supports both session auth and API key auth
 *
 * Disables search engine indexing for a language:
 * - Sets searchEnabled flag to false
 * - Existing indexed content remains searchable
 * - New products won't be indexed in this language
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { refreshLanguageCache } from "@/services/language.service";
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

    // Check if already disabled for search
    if (!language.searchEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: `Search indexing for '${code}' is already disabled`
        },
        { status: 400 }
      );
    }

    // Disable search indexing
    language.searchEnabled = false;
    await language.save();

    // Refresh cache
    await refreshLanguageCache();

    const result = {
      success: true,
      message: `Search indexing disabled for ${language.name} (${code})`,
      language: {
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        isEnabled: language.isEnabled,
        searchEnabled: language.searchEnabled
      }
    };

    console.log(`🔍 Search indexing disabled for language: ${code}`);
    console.log(`ℹ️  Existing indexed content in ${code} will remain searchable until Solr is reindexed`);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error disabling search indexing:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disable search indexing",
        message: error.message
      },
      { status: 500 }
    );
  }
}
