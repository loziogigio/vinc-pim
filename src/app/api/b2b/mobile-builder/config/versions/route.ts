/**
 * Mobile Builder Versions API
 * GET    /api/b2b/mobile-builder/config/versions?config_id=... - List versions
 * POST   /api/b2b/mobile-builder/config/versions?config_id=... - Create version (duplicate current)
 * PATCH  /api/b2b/mobile-builder/config/versions?config_id=... - Switch current version
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { DEFAULT_APP_IDENTITY } from "@/lib/types/mobile-builder";
import { isMobileHome, parseConfigId } from "@/lib/constants/mobile-builder";
import { resolveMobileBuilderAuth } from "../../_shared";

const INVALID_CONFIG_ID = NextResponse.json({ error: "Invalid config_id" }, { status: 400 });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    let configId;
    try {
      configId = parseConfigId(searchParams);
    } catch {
      return INVALID_CONFIG_ID;
    }

    const auth = await resolveMobileBuilderAuth(req, "read");
    if (auth.error) return auth.error;

    const { MobileHomeConfig } = await connectWithModels(auth.tenantDb);

    const versions = await MobileHomeConfig.find({ config_id: configId })
      .select("version status is_current is_current_published created_at updated_at created_by")
      .sort({ version: -1 })
      .lean();

    return NextResponse.json({ versions, total: versions.length });
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    let configId;
    try {
      configId = parseConfigId(searchParams);
    } catch {
      return INVALID_CONFIG_ID;
    }

    const auth = await resolveMobileBuilderAuth(req, "write");
    if (auth.error) return auth.error;

    const { MobileHomeConfig } = await connectWithModels(auth.tenantDb);

    const { from_version } = (await req.json().catch(() => ({}))) as { from_version?: number };

    const sourceConfig = from_version
      ? await MobileHomeConfig.findOne({ config_id: configId, version: from_version }).lean()
      : await MobileHomeConfig.findOne({ config_id: configId, is_current: true }).lean();

    const highestVersion = await MobileHomeConfig.findOne({ config_id: configId })
      .sort({ version: -1 })
      .select("version")
      .lean();

    const nextVersion = (highestVersion?.version || 0) + 1;

    await MobileHomeConfig.updateMany(
      { config_id: configId },
      { $set: { is_current: false } }
    );

    const newConfig = await MobileHomeConfig.create({
      config_id: configId,
      app_identity: isMobileHome(configId)
        ? sourceConfig?.app_identity || DEFAULT_APP_IDENTITY
        : undefined,
      blocks: sourceConfig?.blocks || [],
      version: nextVersion,
      status: "draft",
      is_current: true,
      is_current_published: false,
      created_by: auth.userId,
      updated_by: auth.userId,
    });

    return NextResponse.json({
      success: true,
      config: newConfig.toObject(),
      message: `New version ${nextVersion} created`,
    });
  } catch (error) {
    console.error("Error creating version:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    let configId;
    try {
      configId = parseConfigId(searchParams);
    } catch {
      return INVALID_CONFIG_ID;
    }

    const auth = await resolveMobileBuilderAuth(req, "write");
    if (auth.error) return auth.error;

    const { MobileHomeConfig } = await connectWithModels(auth.tenantDb);

    const { version } = (await req.json()) as { version: number };

    if (!version || typeof version !== "number") {
      return NextResponse.json(
        { error: "version is required and must be a number" },
        { status: 400 }
      );
    }

    const targetConfig = await MobileHomeConfig.findOne({ config_id: configId, version });

    if (!targetConfig) {
      return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 });
    }

    await MobileHomeConfig.updateMany(
      { config_id: configId },
      { $set: { is_current: false } }
    );

    targetConfig.is_current = true;
    await targetConfig.save();

    return NextResponse.json({
      success: true,
      config: targetConfig.toObject(),
      message: `Switched to version ${version}`,
    });
  } catch (error) {
    console.error("Error switching version:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
