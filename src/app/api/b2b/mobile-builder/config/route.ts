/**
 * Mobile Builder Config API
 * GET /api/b2b/mobile-builder/config - Get current config or specific version
 * POST /api/b2b/mobile-builder/config - Save to current version (update in place)
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import type { MobileBlock, MobileAppIdentity } from "@/lib/types/mobile-builder";
import { DEFAULT_APP_IDENTITY } from "@/lib/types/mobile-builder";

const DEFAULT_CONFIG_ID = "mobile-home";

/**
 * GET /api/b2b/mobile-builder/config
 * Get mobile home config
 *
 * Query params:
 * - version: number (optional) - Get specific version
 * - status: "draft" | "published" (default: returns current working version)
 */
export async function GET(req: NextRequest) {
  try {
    // Check for API key authentication first
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

    // Parse query params
    const { searchParams } = new URL(req.url);
    const requestedStatus = searchParams.get("status");
    const requestedVersion = searchParams.get("version");

    let config;

    if (requestedVersion) {
      // Get specific version
      config = await MobileHomeConfig.findOne({
        config_id: DEFAULT_CONFIG_ID,
        version: parseInt(requestedVersion),
      }).lean();
    } else if (requestedStatus === "published") {
      // Get current published version
      config = await MobileHomeConfig.findOne({
        config_id: DEFAULT_CONFIG_ID,
        is_current_published: true,
      }).lean();
    } else if (requestedStatus === "draft") {
      // Get current draft
      config = await MobileHomeConfig.findOne({
        config_id: DEFAULT_CONFIG_ID,
        is_current: true,
        status: "draft",
      }).lean();
    } else {
      // Get current working version (is_current = true)
      config = await MobileHomeConfig.findOne({
        config_id: DEFAULT_CONFIG_ID,
        is_current: true,
      }).lean();

      // If no current, fall back to published
      if (!config) {
        config = await MobileHomeConfig.findOne({
          config_id: DEFAULT_CONFIG_ID,
          is_current_published: true,
        }).lean();
      }
    }

    if (!config) {
      // Return empty config structure for version 1
      return NextResponse.json({
        config: {
          config_id: DEFAULT_CONFIG_ID,
          app_identity: DEFAULT_APP_IDENTITY,
          blocks: [],
          version: 1,
          status: "draft",
          is_current: true,
          is_current_published: false,
        },
        exists: false,
      });
    }

    return NextResponse.json({
      config,
      exists: true,
    });
  } catch (error) {
    console.error("Error fetching mobile config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/mobile-builder/config
 * Save mobile home config - UPDATES current version in place (no new version created)
 *
 * Body:
 * - blocks: MobileBlock[] (required)
 * - app_identity: MobileAppIdentity (optional)
 */
export async function POST(req: NextRequest) {
  try {
    // Check for API key authentication first
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

    const body = await req.json();
    const { blocks, app_identity } = body as {
      blocks: MobileBlock[];
      app_identity?: MobileAppIdentity;
    };

    // Validate blocks
    if (!Array.isArray(blocks)) {
      return NextResponse.json(
        { error: "blocks must be an array" },
        { status: 400 }
      );
    }

    // Sanitize _cached_entities and _cached_products: limit to 50 items per block
    const MAX_CACHED_ITEMS = 50;
    for (const block of blocks) {
      const b = block as any;
      if (b._cached_entities?.length > MAX_CACHED_ITEMS) {
        b._cached_entities = b._cached_entities.slice(0, MAX_CACHED_ITEMS);
      }
      if (b._cached_products?.length > MAX_CACHED_ITEMS) {
        b._cached_products = b._cached_products.slice(0, MAX_CACHED_ITEMS);
      }
    }

    // Get the current version
    const currentConfig = await MobileHomeConfig.findOne({
      config_id: DEFAULT_CONFIG_ID,
      is_current: true,
    });

    if (currentConfig) {
      // UPDATE existing version in place
      currentConfig.blocks = blocks;
      if (app_identity) {
        currentConfig.app_identity = app_identity;
      }
      currentConfig.updated_by = userId;
      currentConfig.status = "draft"; // Ensure it's marked as draft after edit
      await currentConfig.save();

      // Show "Hot fix" only if saving to the currently published version
      const message = currentConfig.is_current_published
        ? `Hot fix (version ${currentConfig.version})`
        : `Draft saved (version ${currentConfig.version})`;

      return NextResponse.json({
        success: true,
        config: currentConfig.toObject(),
        message,
      });
    } else {
      // No current version exists, create version 1
      const newConfig = await MobileHomeConfig.create({
        config_id: DEFAULT_CONFIG_ID,
        app_identity: app_identity || DEFAULT_APP_IDENTITY,
        blocks,
        version: 1,
        status: "draft",
        is_current: true,
        is_current_published: false,
        created_by: userId,
        updated_by: userId,
      });

      return NextResponse.json({
        success: true,
        config: newConfig.toObject(),
        message: "Draft saved (version 1)",
      });
    }
  } catch (error) {
    console.error("Error saving mobile config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
