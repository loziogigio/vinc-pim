/**
 * Disable Language API Route
 * POST /api/admin/languages/:code/disable
 * Supports both session auth and API key auth
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

    // Check if already disabled
    if (!language.isEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: `Language '${code}' is already disabled`
        },
        { status: 400 }
      );
    }

    // Prevent disabling Italian
    if (code === "it") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot disable Italian (it) - it's the required default language"
        },
        { status: 400 }
      );
    }

    // Prevent disabling default language
    if (language.isDefault) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot disable default language '${code}'`
        },
        { status: 400 }
      );
    }

    // Disable language
    language.isEnabled = false;
    await language.save();

    // Refresh cache
    await refreshLanguageCache();

    return NextResponse.json({
      success: true,
      message: `Language '${code}' (${language.name}) disabled successfully`,
      language: {
        code: language.code,
        name: language.name,
        isEnabled: language.isEnabled
      }
    });
  } catch (error: any) {
    console.error("Error disabling language:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disable language",
        message: error.message
      },
      { status: 500 }
    );
  }
}
