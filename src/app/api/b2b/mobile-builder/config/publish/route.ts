/**
 * Mobile Builder Config Publish API
 * POST /api/b2b/mobile-builder/config/publish?config_id=... - Publish current draft
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { parseConfigId } from "@/lib/constants/mobile-builder";
import { resolveMobileBuilderAuth } from "../../_shared";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    let configId;
    try {
      configId = parseConfigId(searchParams);
    } catch {
      return NextResponse.json({ error: "Invalid config_id" }, { status: 400 });
    }

    const auth = await resolveMobileBuilderAuth(req, "write");
    if (auth.error) return auth.error;

    const { MobileHomeConfig } = await connectWithModels(auth.tenantDb);

    const currentDraft = await MobileHomeConfig.findOne({
      config_id: configId,
      is_current: true,
      status: "draft",
    });

    if (!currentDraft) {
      return NextResponse.json({ error: "No draft to publish" }, { status: 404 });
    }

    // Exclude the doc we're about to promote from the unset, so we can `updateOne` it
    // unconditionally afterward. Going through `.save()` here is unsafe: in the hot-fix
    // case the loaded doc already has `is_current_published: true`, so Mongoose's dirty
    // tracking sees "no change" and skips writing the field — leaving the DB at false
    // after the prior updateMany.
    await MobileHomeConfig.updateMany(
      { config_id: configId, _id: { $ne: currentDraft._id }, is_current_published: true },
      { $set: { is_current_published: false } }
    );

    const publishedAt = new Date();
    await MobileHomeConfig.updateOne(
      { _id: currentDraft._id },
      {
        $set: {
          status: "published",
          is_current_published: true,
          published_at: publishedAt,
          updated_by: auth.userId,
        },
      }
    );

    const published = await MobileHomeConfig.findById(currentDraft._id).lean();

    return NextResponse.json({
      success: true,
      config: published,
      message: `Published version ${currentDraft.version}`,
    });
  } catch (error) {
    console.error("Error publishing mobile config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
