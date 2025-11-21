/**
 * Languages API Route
 * GET /api/admin/languages - List all languages
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { LanguageModel } from "@/lib/db/models/language";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

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
