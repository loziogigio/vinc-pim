/**
 * Disable Language API Route
 * POST /api/admin/languages/:code/disable
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { LanguageModel } from "@/lib/db/models/language";
import { refreshLanguageCache } from "@/services/language.service";

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
