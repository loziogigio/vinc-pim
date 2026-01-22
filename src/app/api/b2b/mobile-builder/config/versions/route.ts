/**
 * Mobile Builder Versions API
 * GET /api/b2b/mobile-builder/config/versions - List all versions
 * POST /api/b2b/mobile-builder/config/versions - Create new version (duplicate current)
 * PATCH /api/b2b/mobile-builder/config/versions - Switch to a different version
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { DEFAULT_APP_IDENTITY } from "@/lib/types/mobile-builder";

const DEFAULT_CONFIG_ID = "mobile-home";

/**
 * GET /api/b2b/mobile-builder/config/versions
 * List all versions
 */
export async function GET(req: NextRequest) {
  try {
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "read");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { MobileHomeConfig } = await connectWithModels(tenantDb);

    // Get all versions sorted by version number descending
    const versions = await MobileHomeConfig.find({
      config_id: DEFAULT_CONFIG_ID,
    })
      .select("version status is_current is_current_published created_at updated_at created_by")
      .sort({ version: -1 })
      .lean();

    return NextResponse.json({
      versions,
      total: versions.length,
    });
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/mobile-builder/config/versions
 * Create a new version by duplicating the current version
 *
 * Body (optional):
 * - from_version: number - Version to duplicate (default: current)
 * - name: string - Optional name/label for the version
 */
export async function POST(req: NextRequest) {
  try {
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;
    let userId: string | undefined;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "write");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
      userId = `api-key:${apiKeyResult.keyId}`;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
      userId = session.user?.id;
    }

    const { MobileHomeConfig } = await connectWithModels(tenantDb);

    const body = await req.json().catch(() => ({}));
    const { from_version } = body as { from_version?: number };

    // Get the source version (either specified or current)
    let sourceConfig;
    if (from_version) {
      sourceConfig = await MobileHomeConfig.findOne({
        config_id: DEFAULT_CONFIG_ID,
        version: from_version,
      }).lean();
    } else {
      sourceConfig = await MobileHomeConfig.findOne({
        config_id: DEFAULT_CONFIG_ID,
        is_current: true,
      }).lean();
    }

    // Get the highest version number
    const highestVersion = await MobileHomeConfig.findOne({
      config_id: DEFAULT_CONFIG_ID,
    })
      .sort({ version: -1 })
      .select("version")
      .lean();

    const nextVersion = (highestVersion?.version || 0) + 1;

    // Unset is_current from all versions
    await MobileHomeConfig.updateMany(
      { config_id: DEFAULT_CONFIG_ID },
      { $set: { is_current: false } }
    );

    // Create new version
    const newConfig = await MobileHomeConfig.create({
      config_id: DEFAULT_CONFIG_ID,
      app_identity: sourceConfig?.app_identity || DEFAULT_APP_IDENTITY,
      blocks: sourceConfig?.blocks || [],
      version: nextVersion,
      status: "draft",
      is_current: true,
      is_current_published: false,
      created_by: userId,
      updated_by: userId,
    });

    return NextResponse.json({
      success: true,
      config: newConfig.toObject(),
      message: `New version ${nextVersion} created`,
    });
  } catch (error) {
    console.error("Error creating version:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/mobile-builder/config/versions
 * Switch to a different version (make it current)
 *
 * Body:
 * - version: number - Version to switch to
 */
export async function PATCH(req: NextRequest) {
  try {
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "write");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { MobileHomeConfig } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { version } = body as { version: number };

    if (!version || typeof version !== "number") {
      return NextResponse.json(
        { error: "version is required and must be a number" },
        { status: 400 }
      );
    }

    // Check if version exists
    const targetConfig = await MobileHomeConfig.findOne({
      config_id: DEFAULT_CONFIG_ID,
      version,
    });

    if (!targetConfig) {
      return NextResponse.json(
        { error: `Version ${version} not found` },
        { status: 404 }
      );
    }

    // Unset is_current from all versions
    await MobileHomeConfig.updateMany(
      { config_id: DEFAULT_CONFIG_ID },
      { $set: { is_current: false } }
    );

    // Set is_current on target version
    targetConfig.is_current = true;
    await targetConfig.save();

    return NextResponse.json({
      success: true,
      config: targetConfig.toObject(),
      message: `Switched to version ${version}`,
    });
  } catch (error) {
    console.error("Error switching version:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
