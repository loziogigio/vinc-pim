/**
 * Languages API Route
 * GET /api/admin/languages - List all languages
 * Supports both session auth and API key auth
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // enabled, disabled, all
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "order";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const query: any = {};

    // Filter by enabled/disabled
    if (status === "enabled") {
      query.isEnabled = true;
    } else if (status === "disabled") {
      query.isEnabled = false;
    }

    // Search by code or name
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { nativeName: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [languages, total] = await Promise.all([
      LanguageModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      LanguageModel.countDocuments(query)
    ]);

    const enabledCount = await LanguageModel.countDocuments({ isEnabled: true });
    const disabledCount = await LanguageModel.countDocuments({ isEnabled: false });

    return NextResponse.json({
      success: true,
      data: languages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        total,
        enabled: enabledCount,
        disabled: disabledCount
      }
    });
  } catch (error: any) {
    console.error("Error fetching languages:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch languages",
        message: error.message
      },
      { status: 500 }
    );
  }
}
