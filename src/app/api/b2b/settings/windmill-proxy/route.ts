/**
 * GET/PUT /api/b2b/settings/windmill-proxy
 *
 * Manage Windmill hook proxy settings for the tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { invalidateProxyCache } from "@/lib/services/windmill-proxy.service";
import { windmillCreateFolder } from "@/lib/services/windmill-client";
import type { WindmillProxySettings, WindmillSSOUser } from "@/lib/types/windmill-proxy";
import { HOOK_OPERATIONS, HOOK_PHASES } from "@/lib/types/windmill-proxy";
import { encrypt } from "@/lib/utils/encryption";

const PASSWORD_MASK = "***";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;
  const { HomeSettings } = await connectWithModels(tenantDb);
  const settings = await HomeSettings.findOne({}).lean();

  const proxy = (settings as any)?.windmill_proxy as WindmillProxySettings | undefined;

  const result = proxy || {
    enabled: false,
    timeout_ms: 5000,
    channels: [],
  };

  // Mask SSO passwords in response
  if (result.sso_users) {
    result.sso_users = result.sso_users.map((u) => ({
      ...u,
      windmill_password_encrypted: PASSWORD_MASK,
    }));
  }

  // Check folder status if enabled
  let folderStatus: { exists: boolean; name: string } | undefined;
  if (result.enabled) {
    const folderName = `vinc_${tenantId.replace(/-/g, "_")}`;
    const ws = result.workspace_name || process.env.WINDMILL_WORKSPACE || "";
    const baseUrl = (process.env.WINDMILL_BASE_URL || result.windmill_base_url || "http://windmill:8000").replace(/\/+$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/w/${ws}/folders/get/${folderName}`, {
        headers: { Authorization: `Bearer ${process.env.WINDMILL_TOKEN || ""}` },
        cache: "no-store",
      });
      folderStatus = { exists: res.ok, name: folderName };
    } catch {
      folderStatus = { exists: false, name: folderName };
    }
  }

  return NextResponse.json({ success: true, windmill_proxy: result, folder: folderStatus });
}

export async function PUT(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json();
    const { enabled, windmill_external_url, timeout_ms, channels, sso_users } = body;

    // Validate channels and hooks
    if (channels && Array.isArray(channels)) {
      for (const ch of channels) {
        if (!ch.channel || typeof ch.channel !== "string") {
          return NextResponse.json(
            { error: "Each channel must have a 'channel' string" },
            { status: 400 },
          );
        }
        if (ch.hooks && Array.isArray(ch.hooks)) {
          for (const hook of ch.hooks) {
            if (!HOOK_OPERATIONS.includes(hook.operation)) {
              return NextResponse.json(
                { error: `Invalid operation: ${hook.operation}` },
                { status: 400 },
              );
            }
            if (!HOOK_PHASES.includes(hook.phase)) {
              return NextResponse.json(
                { error: `Invalid phase: ${hook.phase}` },
                { status: 400 },
              );
            }
            if (!hook.script_path || typeof hook.script_path !== "string") {
              return NextResponse.json(
                { error: "Each hook must have a 'script_path' string" },
                { status: 400 },
              );
            }
          }
        }
      }
    }

    // Load existing settings (for preserving workspace_name + encrypted passwords)
    const { HomeSettings } = await connectWithModels(tenantDb);
    const existing = await HomeSettings.findOne({}).lean();
    const currentProxy = (existing as any)?.windmill_proxy as WindmillProxySettings | undefined;

    // Process SSO account — single Windmill account per tenant
    let processedSSOUsers: WindmillSSOUser[] | undefined;
    if (sso_users && Array.isArray(sso_users) && sso_users.length > 0) {
      const u = sso_users[0];
      if (!u.windmill_email) {
        throw new Error("Windmill email is required for SSO");
      }

      const existingAccount = (currentProxy?.sso_users || [])[0] as WindmillSSOUser | undefined;

      let encryptedPassword: string;
      if (u.windmill_password_encrypted === PASSWORD_MASK && existingAccount) {
        // Password unchanged — preserve existing encrypted value
        encryptedPassword = existingAccount.windmill_password_encrypted;
      } else if (u.windmill_password_encrypted && u.windmill_password_encrypted !== PASSWORD_MASK) {
        // New password — encrypt it
        encryptedPassword = encrypt(u.windmill_password_encrypted);
      } else {
        throw new Error("Windmill password is required");
      }

      processedSSOUsers = [{
        vinc_email: u.vinc_email || "shared",
        windmill_email: u.windmill_email,
        windmill_password_encrypted: encryptedPassword,
      }];
    }

    const proxySettings: WindmillProxySettings = {
      enabled: enabled ?? false,
      windmill_base_url: currentProxy?.windmill_base_url, // read-only — from env or super admin
      windmill_external_url: windmill_external_url || undefined,
      workspace_name: currentProxy?.workspace_name, // read-only — only super admin can set
      timeout_ms: timeout_ms ?? 5000,
      channels: channels || [],
      sso_users: processedSSOUsers,
    };

    // Create Windmill folder when enabling for the first time (best-effort)
    if (proxySettings.enabled) {
      const baseUrl = process.env.WINDMILL_BASE_URL || proxySettings.windmill_base_url || "http://windmill:8000";
      try {
        await windmillCreateFolder(tenantId, baseUrl, proxySettings.workspace_name);
      } catch (err) {
        console.warn(`[Windmill] Folder creation failed (non-blocking):`, err);
      }
    }
    await HomeSettings.updateOne(
      {},
      { $set: { windmill_proxy: proxySettings } },
      { upsert: true },
    );

    // Invalidate cache so changes take effect immediately
    invalidateProxyCache(tenantDb);

    // Mask passwords in response
    const responseSettings = {
      ...proxySettings,
      sso_users: proxySettings.sso_users?.map((u) => ({
        ...u,
        windmill_password_encrypted: PASSWORD_MASK,
      })),
    };

    return NextResponse.json({
      success: true,
      message: "Windmill proxy settings saved",
      windmill_proxy: responseSettings,
    });
  } catch (error) {
    console.error("[Windmill Proxy Settings] PUT error:", error);
    const msg = error instanceof Error ? error.message : "Failed to save windmill proxy settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
