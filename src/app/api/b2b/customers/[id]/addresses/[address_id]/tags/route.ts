/**
 * Address Tag Override API
 *
 * PUT    /api/b2b/customers/[id]/addresses/[address_id]/tags - Add/replace a tag override
 * DELETE /api/b2b/customers/[id]/addresses/[address_id]/tags - Remove a tag override
 * GET    /api/b2b/customers/[id]/addresses/[address_id]/tags - List effective tags for address
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
import {
  resolveEffectiveTagsFromRefs,
  upsertTagRef,
  removeTagRef,
} from "@/lib/services/tag-pricing.service";
import type { ICustomerTagRef } from "@/lib/db/models/customer-tag";

type RouteParams = { params: Promise<{ id: string; address_id: string }> };

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
 * GET /api/b2b/customers/[id]/addresses/[address_id]/tags
 * Returns the effective tags for a customer+address combination.
 * (Customer defaults merged with address overrides.)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customer_id, address_id } = await params;

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
      { tags: 1, addresses: 1 }
    ).lean();

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const address = (customer.addresses || []).find(
      (a: { address_id: string }) => a.address_id === address_id
    );
    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const customerTags: ICustomerTagRef[] = customer.tags || [];
    const addressOverrides: ICustomerTagRef[] = address.tag_overrides || [];

    const effectiveTags = resolveEffectiveTagsFromRefs(customerTags, addressOverrides);

    return NextResponse.json({
      success: true,
      customer_tags: customerTags,
      address_overrides: addressOverrides,
      effective_tags: effectiveTags,
    });
  } catch (error) {
    console.error("Error fetching address tags:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/b2b/customers/[id]/addresses/[address_id]/tags
 * Add or replace a tag override on the address.
 * Body: { full_tag }
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customer_id, address_id } = await params;

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
        { error: "full_tag is required (e.g. 'categoria-di-sconto:sconto-50')" },
        { status: 400 }
      );
    }

    // Look up the tag definition
    const tagDef = await CustomerTagModel.findOne({ full_tag, is_active: true }).lean();
    if (!tagDef) {
      return NextResponse.json(
        { error: `Tag not found or inactive: ${full_tag}` },
        { status: 404 }
      );
    }

    const tagRef: ICustomerTagRef = {
      tag_id: (tagDef as { tag_id: string }).tag_id,
      full_tag: (tagDef as { full_tag: string }).full_tag,
      prefix: (tagDef as { prefix: string }).prefix,
      code: (tagDef as { code: string }).code,
    };

    // Find customer and locate the address
    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const addressIndex = (customer.addresses || []).findIndex(
      (a: { address_id: string }) => a.address_id === address_id
    );
    if (addressIndex === -1) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const currentOverrides: ICustomerTagRef[] =
      customer.addresses[addressIndex].tag_overrides || [];
    const updatedOverrides = upsertTagRef(currentOverrides, tagRef);

    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id, tenant_id: tenantId },
      { $set: { [`addresses.${addressIndex}.tag_overrides`]: updatedOverrides } },
      { new: true }
    ).lean();

    const updatedAddress = (updatedCustomer?.addresses || []).find(
      (a: { address_id: string }) => a.address_id === address_id
    );

    // Compute effective tags for response
    const effectiveTags = resolveEffectiveTagsFromRefs(
      updatedCustomer?.tags || [],
      updatedAddress?.tag_overrides || []
    );

    return NextResponse.json({
      success: true,
      address_overrides: updatedAddress?.tag_overrides || [],
      effective_tags: effectiveTags,
      message: `Tag override ${full_tag} assigned to address ${address_id}`,
    });
  } catch (error) {
    console.error("Error assigning address tag override:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/customers/[id]/addresses/[address_id]/tags
 * Remove a tag override from the address.
 * Body: { full_tag }
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customer_id, address_id } = await params;

    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel } = auth.models;

    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { full_tag } = body;

    if (!full_tag) {
      return NextResponse.json({ error: "full_tag is required" }, { status: 400 });
    }

    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const addressIndex = (customer.addresses || []).findIndex(
      (a: { address_id: string }) => a.address_id === address_id
    );
    if (addressIndex === -1) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const currentOverrides: ICustomerTagRef[] =
      customer.addresses[addressIndex].tag_overrides || [];
    const updatedOverrides = removeTagRef(currentOverrides, full_tag);

    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id, tenant_id: tenantId },
      { $set: { [`addresses.${addressIndex}.tag_overrides`]: updatedOverrides } },
      { new: true }
    ).lean();

    const updatedAddress = (updatedCustomer?.addresses || []).find(
      (a: { address_id: string }) => a.address_id === address_id
    );

    const effectiveTags = resolveEffectiveTagsFromRefs(
      updatedCustomer?.tags || [],
      updatedAddress?.tag_overrides || []
    );

    return NextResponse.json({
      success: true,
      address_overrides: updatedAddress?.tag_overrides || [],
      effective_tags: effectiveTags,
      message: `Tag override ${full_tag} removed from address ${address_id}`,
    });
  } catch (error) {
    console.error("Error removing address tag override:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
