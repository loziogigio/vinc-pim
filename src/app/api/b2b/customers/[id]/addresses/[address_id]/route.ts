import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { IAddress } from "@/lib/db/models/customer";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getPortalUserFromRequest,
  hasCustomerAccess,
} from "@/lib/auth/portal-user-token";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import type { UpdateAddressRequest } from "@/lib/types/customer";

/**
 * Authenticate and get tenant ID
 * Also checks for portal user token and returns customer access restrictions
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  customerAccess?: ICustomerAccess[];
  models?: Awaited<ReturnType<typeof connectWithModels>>;
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

  // Get models for the tenant database
  const models = await connectWithModels(tenantDb);

  // Check for portal user token (additional access restriction)
  const portalUser = await getPortalUserFromRequest(req, tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    customerAccess: portalUser?.customerAccess,
    models,
  };
}

/**
 * PATCH /api/b2b/customers/[id]/addresses/[address_id]
 * Update an address
 * Supports both session auth and API key auth
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; address_id: string }> }
) {
  try {
    const { id: customer_id, address_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel } = auth.models!;

    // Portal user access check
    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Find the customer (with tenant filter for security)
    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Find the address
    const addressIndex = customer.addresses.findIndex(
      (a: IAddress) => a.address_id === address_id
    );

    if (addressIndex === -1) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    const body: UpdateAddressRequest = await req.json();

    // Build update object for the specific address
    const allowedFields = [
      "external_code",
      "address_type",
      "label",
      "is_default",
      "recipient_name",
      "street_address",
      "street_address_2",
      "city",
      "province",
      "postal_code",
      "country",
      "phone",
      "delivery_notes",
    ];

    const updateDoc: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field as keyof UpdateAddressRequest] !== undefined) {
        updateDoc[`addresses.${addressIndex}.${field}`] =
          body[field as keyof UpdateAddressRequest];
      }
    }

    // Always update updated_at
    updateDoc[`addresses.${addressIndex}.updated_at`] = new Date();

    // Handle default address changes
    if (body.is_default === true) {
      const addressType =
        body.address_type || customer.addresses[addressIndex].address_type;

      // Unset other defaults of the same type
      if (addressType === "delivery" || addressType === "both") {
        // First, unset existing delivery defaults
        await CustomerModel.updateOne(
          { customer_id, tenant_id: tenantId },
          {
            $set: {
              "addresses.$[elem].is_default": false,
            },
          },
          {
            arrayFilters: [
              {
                "elem.is_default": true,
                "elem.address_type": { $in: ["delivery", "both"] },
                "elem.address_id": { $ne: address_id },
              },
            ],
          }
        );
        updateDoc.default_shipping_address_id = address_id;
      }

      if (addressType === "billing" || addressType === "both") {
        // Unset existing billing defaults
        await CustomerModel.updateOne(
          { customer_id, tenant_id: tenantId },
          {
            $set: {
              "addresses.$[elem].is_default": false,
            },
          },
          {
            arrayFilters: [
              {
                "elem.is_default": true,
                "elem.address_type": { $in: ["billing", "both"] },
                "elem.address_id": { $ne: address_id },
              },
            ],
          }
        );
        updateDoc.default_billing_address_id = address_id;
      }
    }

    // If unsetting default, clear the default ID fields
    if (body.is_default === false) {
      const currentAddress = customer.addresses[addressIndex];
      if (customer.default_shipping_address_id === address_id) {
        updateDoc.default_shipping_address_id = null;
      }
      if (customer.default_billing_address_id === address_id) {
        updateDoc.default_billing_address_id = null;
      }
    }

    // Update the address (with tenant filter for security)
    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id, tenant_id: tenantId },
      { $set: updateDoc },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      message: "Address updated successfully",
    });
  } catch (error) {
    console.error("Error updating address:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/customers/[id]/addresses/[address_id]
 * Remove an address from a customer
 * Supports both session auth and API key auth
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; address_id: string }> }
) {
  try {
    const { id: customer_id, address_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel } = auth.models!;

    // Portal user access check
    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Find the customer (with tenant filter for security)
    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Find the address
    const address = customer.addresses.find((a: IAddress) => a.address_id === address_id);

    if (!address) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    // Build update - remove address and clear default IDs if needed
    const updateDoc: Record<string, unknown> = {};

    if (customer.default_shipping_address_id === address_id) {
      updateDoc.default_shipping_address_id = null;
    }
    if (customer.default_billing_address_id === address_id) {
      updateDoc.default_billing_address_id = null;
    }

    // Remove the address (with tenant filter for security)
    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id, tenant_id: tenantId },
      {
        $pull: { addresses: { address_id } },
        ...(Object.keys(updateDoc).length > 0 ? { $set: updateDoc } : {}),
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      message: "Address removed successfully",
    });
  } catch (error) {
    console.error("Error removing address:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
