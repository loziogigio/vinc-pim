import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { resolvePublicStorefront } from "@/lib/services/b2c-public-resolve";
import { getPublishedB2CHomeTemplate } from "@/lib/db/b2c-home-templates";

/**
 * GET /api/b2b/b2c/public/home
 *
 * Public API for B2C frontends (Next.js, Nuxt.js, Flutter, etc.).
 * Authenticates tenant via API key, then looks up the storefront
 * by the Origin header's domain.
 *
 * Headers:
 *   x-auth-method: api-key
 *   x-api-key-id: ak_{tenant}_{key}
 *   x-api-secret: sk_{secret}
 *   Origin: https://shop.example.com
 *
 * Response:
 *   { blocks, seo, storefront: { name, slug, branding, header, footer } }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate tenant via API key
    const keyId = req.headers.get("x-api-key-id");
    const secret = req.headers.get("x-api-secret");
    if (!keyId || !secret) {
      return NextResponse.json(
        { error: "Missing API key credentials" },
        { status: 401 }
      );
    }

    const authResult = await verifyAPIKey(keyId, secret);
    if (!authResult.valid || !authResult.tenantId) {
      return NextResponse.json(
        { error: authResult.error || "Invalid API key" },
        { status: 401 }
      );
    }

    const tenantDb = `vinc-${authResult.tenantId}`;

    // 2. Resolve storefront (?storefront=<slug> or Origin/Referer domain)
    const resolved = await resolvePublicStorefront(req, tenantDb);
    if ("response" in resolved) return resolved.response;
    const storefront = resolved.storefront;

    // 4. Build storefront metadata (branding, header, footer)
    const storefrontMeta = {
      name: storefront.name,
      slug: storefront.slug,
      branding: storefront.branding || {},
      header: storefront.header || {},
      header_config: (storefront as any).header_config || { rows: [] },
      footer: storefront.footer || {},
      meta_tags: (storefront as any).meta_tags || {},
      custom_scripts: ((storefront as any).custom_scripts || [])
        .filter((s: any) => s.enabled),
      custom_css: (storefront as any).custom_css || "",
    };

    // 5. Get published home template
    const template = await getPublishedB2CHomeTemplate(storefront.slug, tenantDb);
    if (!template) {
      return NextResponse.json(
        { blocks: [], seo: {}, storefront: storefrontMeta }
      );
    }

    return NextResponse.json({
      ...template,
      storefront: storefrontMeta,
    });
  } catch (error) {
    console.error("[GET /api/b2b/b2c/public/home]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
