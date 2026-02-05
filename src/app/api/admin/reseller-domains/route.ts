/**
 * /api/admin/reseller-domains
 *
 * GET  - List all reseller domains (optionally filtered by tenant)
 * POST - Create a new reseller domain
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import {
  getResellerDomainModel,
  generateVerificationToken,
  isValidHostname,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
} from "@/lib/db/models/admin-reseller-domain";

/**
 * GET /api/admin/reseller-domains
 * List all reseller domains
 *
 * Query params:
 * - tenant_id: Filter by tenant
 * - customer_id: Filter by reseller customer
 * - is_active: Filter by active status
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");
    const customerId = searchParams.get("customer_id");
    const isActive = searchParams.get("is_active");

    const ResellerDomainModel = await getResellerDomainModel();

    // Build query
    const query: Record<string, unknown> = {};
    if (tenantId) {
      query.tenant_ids = tenantId;
    }
    if (customerId) {
      query.customer_id = customerId;
    }
    if (isActive !== null) {
      query.is_active = isActive === "true";
    }

    const domains = await ResellerDomainModel.find(query)
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      domains,
      count: domains.length,
    });
  } catch (error) {
    console.error("List reseller domains error:", error);
    return NextResponse.json(
      { error: "Failed to list reseller domains" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/reseller-domains
 * Create a new reseller domain
 *
 * Body:
 * - hostname: string (required) - e.g., "shop.reseller.com"
 * - tenant_ids: string[] (required) - Tenants this reseller can access
 * - customer_id: string (required) - The reseller customer ID
 * - primary_tenant_id: string (required) - Main tenant for billing
 * - protocol?: "http" | "https" (default: "https")
 * - subscription_plan?: SubscriptionPlan (default: "free")
 * - branding?: { logo_url, favicon_url, primary_color, store_name }
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const {
      hostname,
      tenant_ids,
      customer_id,
      primary_tenant_id,
      protocol = "https",
      subscription_plan = "free",
      branding,
    } = body;

    // Validate required fields
    if (!hostname) {
      return NextResponse.json(
        { error: "hostname is required" },
        { status: 400 }
      );
    }
    if (!isValidHostname(hostname)) {
      return NextResponse.json(
        { error: "Invalid hostname format. Must be a valid domain (e.g., shop.example.com)" },
        { status: 400 }
      );
    }
    if (!tenant_ids || !Array.isArray(tenant_ids) || tenant_ids.length === 0) {
      return NextResponse.json(
        { error: "tenant_ids is required and must be a non-empty array" },
        { status: 400 }
      );
    }
    if (!customer_id) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 }
      );
    }
    if (!primary_tenant_id) {
      return NextResponse.json(
        { error: "primary_tenant_id is required" },
        { status: 400 }
      );
    }
    if (!tenant_ids.includes(primary_tenant_id)) {
      return NextResponse.json(
        { error: "primary_tenant_id must be included in tenant_ids" },
        { status: 400 }
      );
    }
    if (subscription_plan && !SUBSCRIPTION_PLANS.includes(subscription_plan as SubscriptionPlan)) {
      return NextResponse.json(
        { error: `Invalid subscription_plan. Must be one of: ${SUBSCRIPTION_PLANS.join(", ")}` },
        { status: 400 }
      );
    }

    const ResellerDomainModel = await getResellerDomainModel();

    // Check if hostname already exists
    const existing = await ResellerDomainModel.hostnameExists(hostname);
    if (existing) {
      return NextResponse.json(
        { error: `Hostname '${hostname}' is already registered` },
        { status: 409 }
      );
    }

    // Create domain with verification token
    const verificationToken = generateVerificationToken();

    const domain = await ResellerDomainModel.create({
      hostname: hostname.toLowerCase(),
      protocol,
      tenant_ids,
      customer_id,
      primary_tenant_id,
      subscription: {
        plan: subscription_plan,
        started_at: new Date(),
      },
      verification_token: verificationToken,
      is_verified: false,
      is_active: true,
      branding,
    });

    return NextResponse.json({
      success: true,
      domain,
      verification: {
        token: verificationToken,
        instructions: `Add a TXT record to your DNS: _vinc-verify.${hostname} = ${verificationToken}`,
      },
    });
  } catch (error) {
    console.error("Create reseller domain error:", error);
    const message = error instanceof Error ? error.message : "Failed to create reseller domain";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
