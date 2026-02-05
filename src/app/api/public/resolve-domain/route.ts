/**
 * /api/public/resolve-domain
 *
 * Public endpoint for vinc-vetrina to resolve a hostname to reseller context.
 * Used when a request arrives at a reseller's custom domain.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getResellerDomainModel,
  isSubscriptionValid,
} from "@/lib/db/models/admin-reseller-domain";

/**
 * GET /api/public/resolve-domain?hostname=shop.example.com
 *
 * Resolves a hostname to reseller context for vinc-vetrina.
 * Returns tenant info, reseller ID, and branding if configured.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hostname = searchParams.get("hostname");

    if (!hostname) {
      return NextResponse.json(
        { error: "hostname query parameter is required" },
        { status: 400 }
      );
    }

    const ResellerDomainModel = await getResellerDomainModel();
    const domain = await ResellerDomainModel.findByHostname(hostname.toLowerCase());

    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          error: "Domain not registered",
        },
        { status: 404 }
      );
    }

    // Check if domain is active
    if (!domain.is_active) {
      return NextResponse.json(
        {
          success: false,
          found: true,
          error: "Domain is inactive",
        },
        { status: 403 }
      );
    }

    // Check if domain is verified (optional - might allow unverified in dev)
    if (!domain.is_verified) {
      return NextResponse.json(
        {
          success: false,
          found: true,
          error: "Domain not verified",
        },
        { status: 403 }
      );
    }

    // Check subscription validity
    if (!isSubscriptionValid(domain.subscription)) {
      return NextResponse.json(
        {
          success: false,
          found: true,
          error: "Subscription expired",
        },
        { status: 403 }
      );
    }

    // Return reseller context
    return NextResponse.json({
      success: true,
      found: true,
      context: {
        // Domain info
        hostname: domain.hostname,
        protocol: domain.protocol,

        // Tenant & reseller info
        tenant_ids: domain.tenant_ids,
        primary_tenant_id: domain.primary_tenant_id,
        customer_id: domain.customer_id,

        // Subscription
        subscription: {
          plan: domain.subscription.plan,
          expires_at: domain.subscription.expires_at,
        },

        // Branding (if configured)
        branding: domain.branding || null,
      },
    });
  } catch (error) {
    console.error("Resolve domain error:", error);
    return NextResponse.json(
      { error: "Failed to resolve domain" },
      { status: 500 }
    );
  }
}
