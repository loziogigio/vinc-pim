/**
 * Customer Tag Assignment API
 *
 * PUT    /api/b2b/customers/[id]/tags - Add/replace a tag on the customer (by prefix)
 * DELETE /api/b2b/customers/[id]/tags - Remove a tag from the customer
 * GET    /api/b2b/customers/[id]/tags - List effective tags (customer defaults)
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getPortalUserFromRequest,
  hasCustomerAccess,
} from "@/lib/auth/portal-user-token";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import { upsertTagRef, removeTagRef } from "@/lib/services/tag-pricing.service";

async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  models?: Awaited<ReturnType<typeof connectWithModels>>;
  customerAccess?: ICustomerAccess[];
  error?: string;
  statusCode?: number;
}> {
  const authMethod = req.headers.get("x-auth-method");
  let tenantId: string;
  let tenantDb: string;

  if (authMethod === "api-key") {
    const apiKeyResult = await verifyAPIKeyFromRequest(req, "customers");
    if (!apiKeyResult.authenticated) {
      return {
        authenticated: false,
        error: apiKeyResult.error || "Unauthorized",
        statusCode: apiKeyResult.statusCode || 401,
      };
    }
    tenantId = apiKeyResult.tenantId!;
    tenantDb = apiKeyResult.tenantDb!;
  } else {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return { authenticated: false, error: "Unauthorized", statusCode: 401 };
    }
    tenantId = session.tenantId;
    tenantDb = `vinc-${session.tenantId}`;
  }

  const models = await connectWithModels(tenantDb);
  const portalUser = await getPortalUserFromRequest(req, tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    models,
    customerAccess: portalUser?.customerAccess,
  };
}

/**
 * GET /api/b2b/customers/[id]/tags
 * Returns the customer's default tags.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customer_id } = await params;

    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel } = auth.models;

    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const customer = await CustomerModel.findOne(
      { customer_id, tenant_id: tenantId },
      { tags: 1 }
    ).lean();

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, tags: customer.tags || [] });
  } catch (error) {
    console.error("Error fetching customer tags:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/b2b/customers/[id]/tags
 * Add or replace a tag on the customer. Within the same prefix, old value is replaced.
 * Body: { tag_id, full_tag, prefix, code }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customer_id } = await params;

    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel, CustomerTag: CustomerTagModel } = auth.models;

    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { full_tag } = body;

    if (!full_tag) {
      return NextResponse.json(
        { error: "full_tag is required (e.g. 'categoria-di-sconto:sconto-45')" },
        { status: 400 }
      );
    }

    // Look up the tag definition to get all ref fields
    const tagDef = await CustomerTagModel.findOne({ full_tag, is_active: true }).lean();
    if (!tagDef) {
      return NextResponse.json(
        { error: `Tag not found or inactive: ${full_tag}` },
        { status: 404 }
      );
    }

    const tagRef = {
      tag_id: (tagDef as { tag_id: string }).tag_id,
      full_tag: (tagDef as { full_tag: string }).full_tag,
      prefix: (tagDef as { prefix: string }).prefix,
      code: (tagDef as { code: string }).code,
    };

    // Find customer
    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Upsert (replaces tag with same prefix+code, or adds new)
    const updatedTags = upsertTagRef(customer.tags || [], tagRef);

    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id, tenant_id: tenantId },
      { $set: { tags: updatedTags } },
      { new: true }
    ).lean();

    // Update customer_count on tag definition
    const count = await CustomerModel.countDocuments({
      tenant_id: tenantId,
      "tags.full_tag": full_tag,
    });
    await CustomerTagModel.updateOne({ full_tag }, { $set: { customer_count: count } });

    return NextResponse.json({
      success: true,
      tags: updatedCustomer?.tags || [],
      message: `Tag ${full_tag} assigned`,
    });
  } catch (error) {
    console.error("Error assigning customer tag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/customers/[id]/tags
 * Remove a tag from the customer.
 * Body: { full_tag }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customer_id } = await params;

    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel, CustomerTag: CustomerTagModel } = auth.models;

    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { full_tag } = body;

    if (!full_tag) {
      return NextResponse.json(
        { error: "full_tag is required" },
        { status: 400 }
      );
    }

    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updatedTags = removeTagRef(customer.tags || [], full_tag);

    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id, tenant_id: tenantId },
      { $set: { tags: updatedTags } },
      { new: true }
    ).lean();

    // Update customer_count on tag definition
    const count = await CustomerModel.countDocuments({
      tenant_id: tenantId,
      "tags.full_tag": full_tag,
    });
    await CustomerTagModel.updateOne({ full_tag }, { $set: { customer_count: count } });

    return NextResponse.json({
      success: true,
      tags: updatedCustomer?.tags || [],
      message: `Tag ${full_tag} removed`,
    });
  } catch (error) {
    console.error("Error removing customer tag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
