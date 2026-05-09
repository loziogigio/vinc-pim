/**
 * Mobile Builder Config API
 * GET  /api/b2b/mobile-builder/config?config_id=...&status=...&version=...
 * POST /api/b2b/mobile-builder/config?config_id=...
 *
 * `config_id` accepts `"mobile-home"` (default) or `"post-login"`.
 * `app_identity` is persisted only on the `mobile-home` config; any
 * `app_identity` in a POST body for `post-login` is ignored.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import type { MobileBlock, MobileAppIdentity } from "@/lib/types/mobile-builder";
import { DEFAULT_APP_IDENTITY } from "@/lib/types/mobile-builder";
import { isMobileHome, parseConfigId } from "@/lib/constants/mobile-builder";
import { resolveMobileBuilderAuth } from "../_shared";

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

    const requestedStatus = searchParams.get("status");
    const requestedVersion = searchParams.get("version");

    let config;
    if (requestedVersion) {
      config = await MobileHomeConfig.findOne({
        config_id: configId,
        version: parseInt(requestedVersion),
      }).lean();
    } else if (requestedStatus === "published") {
      config = await MobileHomeConfig.findOne({
        config_id: configId,
        is_current_published: true,
      }).lean();
    } else if (requestedStatus === "draft") {
      config = await MobileHomeConfig.findOne({
        config_id: configId,
        is_current: true,
        status: "draft",
      }).lean();
    } else {
      config =
        (await MobileHomeConfig.findOne({ config_id: configId, is_current: true }).lean()) ||
        (await MobileHomeConfig.findOne({
          config_id: configId,
          is_current_published: true,
        }).lean());
    }

    if (!config) {
      const empty = {
        config_id: configId,
        blocks: [],
        version: 1,
        status: "draft" as const,
        is_current: true,
        is_current_published: false,
        ...(isMobileHome(configId) ? { app_identity: DEFAULT_APP_IDENTITY } : {}),
      };
      return NextResponse.json({ config: empty, exists: false });
    }

    // Coalesce legacy mobile-home docs missing post_login_mode
    if (isMobileHome(configId) && config.app_identity) {
      const identity = config.app_identity as Partial<MobileAppIdentity>;
      if (identity.post_login_mode === undefined) {
        config.app_identity = {
          ...DEFAULT_APP_IDENTITY,
          ...identity,
          post_login_mode: "standard",
        };
      }
    }

    return NextResponse.json({ config, exists: true });
  } catch (error) {
    console.error("Error fetching mobile config:", error);
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

    const body = await req.json();
    const { blocks, app_identity } = body as {
      blocks: MobileBlock[];
      app_identity?: MobileAppIdentity;
    };

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
    }

    const MAX_CACHED_ITEMS = 50;
    for (const block of blocks) {
      const b = block as unknown as {
        _cached_entities?: unknown[];
        _cached_products?: unknown[];
      };
      if (b._cached_entities && b._cached_entities.length > MAX_CACHED_ITEMS) {
        b._cached_entities = b._cached_entities.slice(0, MAX_CACHED_ITEMS);
      }
      if (b._cached_products && b._cached_products.length > MAX_CACHED_ITEMS) {
        b._cached_products = b._cached_products.slice(0, MAX_CACHED_ITEMS);
      }
    }

    // Locate the doc we'll save to. Preference order:
    //   1. The current draft (`is_current: true`)
    //   2. The currently-published version — adopt it as the draft (hot-fix semantics)
    //   3. The highest existing version — recovery from a bad state where no flag is set
    // Only if none of the above exist do we create a brand-new v1.
    let target = await MobileHomeConfig.findOne({
      config_id: configId,
      is_current: true,
    });
    if (!target) {
      target =
        (await MobileHomeConfig.findOne({
          config_id: configId,
          is_current_published: true,
        })) ||
        (await MobileHomeConfig.findOne({ config_id: configId }).sort({ version: -1 }));
      if (target) {
        target.is_current = true;
      }
    }

    if (target) {
      target.blocks = blocks;
      if (isMobileHome(configId) && app_identity) {
        target.app_identity = app_identity;
      }
      target.updated_by = auth.userId;
      target.status = "draft";
      await target.save();

      const message = target.is_current_published
        ? `Hot fix (version ${target.version})`
        : `Draft saved (version ${target.version})`;

      return NextResponse.json({
        success: true,
        config: target.toObject(),
        message,
      });
    }

    const newConfig = await MobileHomeConfig.create({
      config_id: configId,
      app_identity: isMobileHome(configId) ? app_identity || DEFAULT_APP_IDENTITY : undefined,
      blocks,
      version: 1,
      status: "draft",
      is_current: true,
      is_current_published: false,
      created_by: auth.userId,
      updated_by: auth.userId,
    });

    return NextResponse.json({
      success: true,
      config: newConfig.toObject(),
      message: "Draft saved (version 1)",
    });
  } catch (error) {
    console.error("Error saving mobile config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
