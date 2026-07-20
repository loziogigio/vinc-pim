/**
 * B2C Public Storefront Resolution
 *
 * Shared resolver for the `/api/b2b/b2c/public/*` content APIs. Resolves
 * the target storefront for a request that has already passed API-key
 * authentication.
 *
 * Priority:
 *   1. Explicit `?storefront=<slug>` — for API-key-authenticated callers
 *      that don't have (or don't want to rely on) an Origin/Referer header,
 *      e.g. path-routed hosts like vinc-office.
 *   2. Origin/Referer domain lookup — legacy flow, moved verbatim from the
 *      6 public routes that previously duplicated this block inline.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getStorefrontByDomain,
  getStorefrontBySlug,
} from "@/lib/services/b2c-storefront.service";
import type { IB2CStorefront } from "@/lib/db/models/b2c-storefront";

export type PublicResolveResult =
  | { storefront: IB2CStorefront }
  | { response: NextResponse }; // ready 400/404 error response

/**
 * Resolve the target storefront for a public content request.
 * Priority: explicit ?storefront=<slug> (API-key-authenticated callers,
 * e.g. vinc-office slug-routed stores) → Origin/Referer domain lookup (legacy).
 */
export async function resolvePublicStorefront(
  req: NextRequest,
  tenantDb: string
): Promise<PublicResolveResult> {
  const slugParam = req.nextUrl.searchParams.get("storefront");
  if (slugParam) {
    const storefront = await getStorefrontBySlug(tenantDb, slugParam);
    if (!storefront || storefront.status !== "active") {
      return {
        response: NextResponse.json(
          { error: `No active storefront with slug "${slugParam}"` },
          { status: 404 }
        ),
      };
    }
    return { storefront };
  }

  // legacy Origin/Referer flow — moved verbatim from the routes
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) {
    return {
      response: NextResponse.json(
        { error: "Origin header is required (or pass ?storefront=<slug>)" },
        { status: 400 }
      ),
    };
  }

  let domain: string;
  try {
    domain = new URL(origin).hostname;
  } catch {
    return {
      response: NextResponse.json(
        { error: "Invalid Origin header" },
        { status: 400 }
      ),
    };
  }

  const storefront = await getStorefrontByDomain(tenantDb, domain);
  if (!storefront) {
    return {
      response: NextResponse.json(
        { error: `No storefront found for domain "${domain}"` },
        { status: 404 }
      ),
    };
  }

  return { storefront };
}
