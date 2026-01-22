/**
 * Mobile Builder Config Publish API
 * POST /api/b2b/mobile-builder/config/publish - Publish current draft
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

const DEFAULT_CONFIG_ID = "mobile-home";

/**
 * POST /api/b2b/mobile-builder/config/publish
 * Publish the current draft config
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

    // Get the current draft
    const currentDraft = await MobileHomeConfig.findOne({
      config_id: DEFAULT_CONFIG_ID,
      is_current: true,
      status: "draft",
    });

    if (!currentDraft) {
      return NextResponse.json(
        { error: "No draft to publish" },
        { status: 404 }
      );
    }

    // Unset is_current_published from previous published version
    await MobileHomeConfig.updateMany(
      {
        config_id: DEFAULT_CONFIG_ID,
        is_current_published: true,
      },
      {
        $set: { is_current_published: false },
      }
    );

    // Update current draft to published
    currentDraft.status = "published";
    currentDraft.is_current_published = true;
    currentDraft.published_at = new Date();
    currentDraft.updated_by = userId;
    await currentDraft.save();

    return NextResponse.json({
      success: true,
      config: currentDraft.toObject(),
      message: `Published version ${currentDraft.version}`,
    });
  } catch (error) {
    console.error("Error publishing mobile config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
