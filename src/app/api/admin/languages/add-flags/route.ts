/**
 * Add Flags to Existing Languages API Route
 * POST /api/admin/languages/add-flags - Update existing languages with flag emojis
 * Supports both session auth and API key auth
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

// Map of ISO 639-1 language codes to flag emojis
const languageFlags: Record<string, string> = {
  it: "🇮🇹", en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸",
  pt: "🇵🇹", nl: "🇳🇱", pl: "🇵🇱", cs: "🇨🇿", sk: "🇸🇰",
  hu: "🇭🇺", ro: "🇷🇴", bg: "🇧🇬", hr: "🇭🇷", sl: "🇸🇮",
  sr: "🇷🇸", uk: "🇺🇦", ru: "🇷🇺", el: "🇬🇷", da: "🇩🇰",
  sv: "🇸🇪", no: "🇳🇴", fi: "🇫🇮", et: "🇪🇪", lv: "🇱🇻",
  lt: "🇱🇹", zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", th: "🇹🇭",
  vi: "🇻🇳", id: "🇮🇩", ms: "🇲🇾", ar: "🇸🇦", he: "🇮🇱",
  tr: "🇹🇷", fa: "🇮🇷", hi: "🇮🇳", bn: "🇧🇩", ur: "🇵🇰",
  sw: "🇰🇪", ca: "🇪🇸", is: "🇮🇸", mk: "🇲🇰", sq: "🇦🇱",
  be: "🇧🇾",
};

export async function POST(request: NextRequest) {
  try {
    // Check for API key authentication first
    const authMethod = request.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      // Verify API key and secret
      const apiKeyResult = await verifyAPIKeyFromRequest(request);
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { success: false, error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      // Require valid session authentication
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

    // Fetch all languages
    const languages = await LanguageModel.find({});

    if (languages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No languages found",
          message: "Please seed languages first"
        },
        { status: 404 }
      );
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const updated = [];
    const skipped = [];

    for (const language of languages) {
      const flag = languageFlags[language.code];

      if (flag) {
        if (language.flag !== flag) {
          language.flag = flag;
          await language.save();
          updated.push({ code: language.code, name: language.name, flag });
          updatedCount++;
        } else {
          skipped.push({ code: language.code, name: language.name, flag: language.flag, reason: "already set" });
          skippedCount++;
        }
      } else {
        skipped.push({ code: language.code, name: language.name, reason: "no flag mapping" });
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Language flags updated successfully",
      updated: updatedCount,
      skipped: skippedCount,
      total: languages.length,
      languages: {
        updated,
        skipped
      }
    });
  } catch (error: any) {
    console.error("Error adding language flags:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to add language flags",
        message: error.message
      },
      { status: 500 }
    );
  }
}
