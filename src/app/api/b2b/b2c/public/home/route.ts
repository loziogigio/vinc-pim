import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { getStorefrontByDomain } from "@/lib/services/b2c-storefront.service";
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
 *   { blocks, seo, storefront: { name, slug } }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate tenant via API key
    const authResult = await verifyAPIKeyFromRequest(req);
    if (!authResult.valid || !authResult.tenantId) {
      return NextResponse.json(
        { error: authResult.error || "Invalid API key" },
        { status: 401 }
      );
    }

    const tenantDb = `vinc-${authResult.tenantId}`;

    // 2. Extract domain from Origin header
    const origin = req.headers.get("origin") || req.headers.get("referer");
    if (!origin) {
      return NextResponse.json(
        { error: "Origin header is required to identify the storefront" },
        { status: 400 }
      );
    }

    let domain: string;
    try {
      const url = new URL(origin);
      domain = url.hostname;
    } catch {
      return NextResponse.json(
        { error: "Invalid Origin header" },
        { status: 400 }
      );
    }

    // 3. Look up storefront by domain
    const storefront = await getStorefrontByDomain(tenantDb, domain);
    if (!storefront) {
      return NextResponse.json(
        { error: `No storefront found for domain "${domain}"` },
        { status: 404 }
      );
    }

    // 4. Get published home template
    const template = await getPublishedB2CHomeTemplate(storefront.slug, tenantDb);
    if (!template) {
      return NextResponse.json(
        { blocks: [], seo: {}, storefront: { name: storefront.name, slug: storefront.slug } }
      );
    }

    return NextResponse.json({
      ...template,
      storefront: { name: storefront.name, slug: storefront.slug },
    });
  } catch (error) {
    console.error("[GET /api/b2b/b2c/public/home]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
