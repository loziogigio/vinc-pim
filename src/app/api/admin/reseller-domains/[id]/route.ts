/**
 * /api/admin/reseller-domains/[id]
 *
 * GET    - Get a single reseller domain
 * PUT    - Update a reseller domain
 * DELETE - Delete a reseller domain
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import {
  getResellerDomainModel,
  isValidHostname,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
} from "@/lib/db/models/admin-reseller-domain";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/reseller-domains/[id]
 * Get a single reseller domain by ID
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const ResellerDomainModel = await getResellerDomainModel();

    const domain = await ResellerDomainModel.findById(id).lean();

    if (!domain) {
      return NextResponse.json(
        { error: "Reseller domain not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      domain,
    });
  } catch (error) {
    console.error("Get reseller domain error:", error);
    return NextResponse.json(
      { error: "Failed to get reseller domain" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/reseller-domains/[id]
 * Update a reseller domain
 *
 * Body (all optional):
 * - hostname: string
 * - tenant_ids: string[]
 * - customer_id: string
 * - primary_tenant_id: string
 * - protocol: "http" | "https"
 * - subscription: { plan, expires_at, billing_cycle }
 * - is_active: boolean
 * - is_verified: boolean
 * - branding: { logo_url, favicon_url, primary_color, store_name }
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const ResellerDomainModel = await getResellerDomainModel();

    // Find existing domain
    const existing = await ResellerDomainModel.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Reseller domain not found" },
        { status: 404 }
      );
    }

    // Validate hostname if provided
    if (body.hostname && body.hostname !== existing.hostname) {
      if (!isValidHostname(body.hostname)) {
        return NextResponse.json(
          { error: "Invalid hostname format" },
          { status: 400 }
        );
      }
      // Check if new hostname is already taken
      const hostnameExists = await ResellerDomainModel.hostnameExists(body.hostname);
      if (hostnameExists) {
        return NextResponse.json(
          { error: `Hostname '${body.hostname}' is already registered` },
          { status: 409 }
        );
      }
    }

    // Validate tenant_ids if provided
    if (body.tenant_ids) {
      if (!Array.isArray(body.tenant_ids) || body.tenant_ids.length === 0) {
        return NextResponse.json(
          { error: "tenant_ids must be a non-empty array" },
          { status: 400 }
        );
      }
    }

    // Validate primary_tenant_id
    const tenantIds = body.tenant_ids || existing.tenant_ids;
    const primaryTenantId = body.primary_tenant_id || existing.primary_tenant_id;
    if (!tenantIds.includes(primaryTenantId)) {
      return NextResponse.json(
        { error: "primary_tenant_id must be included in tenant_ids" },
        { status: 400 }
      );
    }

    // Validate subscription plan if provided
    if (body.subscription?.plan && !SUBSCRIPTION_PLANS.includes(body.subscription.plan as SubscriptionPlan)) {
      return NextResponse.json(
        { error: `Invalid subscription_plan. Must be one of: ${SUBSCRIPTION_PLANS.join(", ")}` },
        { status: 400 }
      );
    }

    // Build update object
    const update: Record<string, unknown> = {};

    if (body.hostname) update.hostname = body.hostname.toLowerCase();
    if (body.tenant_ids) update.tenant_ids = body.tenant_ids;
    if (body.customer_id) update.customer_id = body.customer_id;
    if (body.primary_tenant_id) update.primary_tenant_id = body.primary_tenant_id;
    if (body.protocol) update.protocol = body.protocol;
    if (typeof body.is_active === "boolean") update.is_active = body.is_active;
    if (typeof body.is_verified === "boolean") {
      update.is_verified = body.is_verified;
      if (body.is_verified && !existing.verified_at) {
        update.verified_at = new Date();
      }
    }
    if (body.branding !== undefined) update.branding = body.branding;

    // Handle subscription update
    if (body.subscription) {
      const subscriptionUpdate: Record<string, unknown> = { ...existing.subscription };
      if (body.subscription.plan) subscriptionUpdate.plan = body.subscription.plan;
      if (body.subscription.expires_at) subscriptionUpdate.expires_at = new Date(body.subscription.expires_at);
      if (body.subscription.billing_cycle) subscriptionUpdate.billing_cycle = body.subscription.billing_cycle;
      if (body.subscription.external_subscription_id) {
        subscriptionUpdate.external_subscription_id = body.subscription.external_subscription_id;
      }
      update.subscription = subscriptionUpdate;
    }

    const updated = await ResellerDomainModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      domain: updated,
    });
  } catch (error) {
    console.error("Update reseller domain error:", error);
    const message = error instanceof Error ? error.message : "Failed to update reseller domain";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/reseller-domains/[id]
 * Delete a reseller domain
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const ResellerDomainModel = await getResellerDomainModel();

    const deleted = await ResellerDomainModel.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Reseller domain not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Domain '${deleted.hostname}' deleted successfully`,
    });
  } catch (error) {
    console.error("Delete reseller domain error:", error);
    return NextResponse.json(
      { error: "Failed to delete reseller domain" },
      { status: 500 }
    );
  }
}
