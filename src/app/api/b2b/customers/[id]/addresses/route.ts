import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getPortalUserFromRequest,
  hasCustomerAccess,
} from "@/lib/auth/portal-user-token";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import { nanoid } from "nanoid";
import type { AddAddressRequest } from "@/lib/types/customer";

/**
 * Authenticate and get tenant ID
 * Also checks for portal user token and returns customer access restrictions
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  customerAccess?: ICustomerAccess[];
  portalUserId?: string;
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
    portalUserId: portalUser?.portalUserId,
    models,
  };
}

/**
 * POST /api/b2b/customers/[id]/addresses
 * Add a new address to a customer
 * Supports both session auth and API key auth
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customer_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel, PortalUser: PortalUserModel } = auth.models!;

    // Portal user access check - can only add addresses to accessible customers
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

    const body: AddAddressRequest = await req.json();

    // Validate required fields
    if (!body.address_type) {
      return NextResponse.json(
        { error: "address_type is required" },
        { status: 400 }
      );
    }

    if (!body.recipient_name) {
      return NextResponse.json(
        { error: "recipient_name is required" },
        { status: 400 }
      );
    }

    if (!body.street_address) {
      return NextResponse.json(
        { error: "street_address is required" },
        { status: 400 }
      );
    }

    if (!body.city) {
      return NextResponse.json({ error: "city is required" }, { status: 400 });
    }

    if (!body.province) {
      return NextResponse.json(
        { error: "province is required" },
        { status: 400 }
      );
    }

    if (!body.postal_code) {
      return NextResponse.json(
        { error: "postal_code is required" },
        { status: 400 }
      );
    }

    if (!body.country) {
      return NextResponse.json(
        { error: "country is required" },
        { status: 400 }
      );
    }

    // Generate address ID
    const address_id = nanoid(8);
    const now = new Date();

    // Auto-generate external_code if not provided (ADDR-001, ADDR-002, ...)
    let externalCode = body.external_code;
    if (!externalCode) {
      const existingCodes = new Set(
        (customer.addresses || []).map((a: { external_code?: string }) => a.external_code)
      );
      let n = (customer.addresses?.length || 0) + 1;
      do {
        externalCode = `ADDR-${String(n).padStart(3, "0")}`;
        n++;
      } while (existingCodes.has(externalCode));
    }

    // Create new address
    const newAddress = {
      address_id,
      external_code: externalCode,
      address_type: body.address_type,
      label: body.label,
      is_default: body.is_default ?? false,
      recipient_name: body.recipient_name,
      street_address: body.street_address,
      street_address_2: body.street_address_2,
      city: body.city,
      province: body.province,
      postal_code: body.postal_code,
      country: body.country,
      phone: body.phone,
      delivery_notes: body.delivery_notes,
      created_at: now,
      updated_at: now,
    };

    // If setting as default, unset other defaults of same type
    const updateOps: Record<string, unknown> = {
      $push: { addresses: newAddress },
    };

    if (body.is_default) {
      // Update existing addresses to not be default for this type
      const addressType = body.address_type;

      if (addressType === "delivery" || addressType === "both") {
        // Unset existing delivery defaults
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
              },
            ],
          }
        );
        updateOps.$set = {
          ...(updateOps.$set as Record<string, unknown> || {}),
          default_shipping_address_id: address_id,
        };
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
              },
            ],
          }
        );
        updateOps.$set = {
          ...(updateOps.$set as Record<string, unknown> || {}),
          default_billing_address_id: address_id,
        };
      }
    }

    // Add the new address (with tenant filter for security)
    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id, tenant_id: tenantId },
      updateOps,
      { new: true }
    ).lean();

    // Auto-add address to portal user's access if they have specific address access
    if (auth.portalUserId && auth.customerAccess) {
      const customerAccessEntry = auth.customerAccess.find(
        (ca) => ca.customer_id === customer_id
      );
      // Only add if user has specific address access (array), not "all"
      if (customerAccessEntry && Array.isArray(customerAccessEntry.address_access)) {
        await PortalUserModel.updateOne(
          {
            portal_user_id: auth.portalUserId,
            tenant_id: tenantId,
            "customer_access.customer_id": customer_id,
          },
          {
            $addToSet: {
              "customer_access.$.address_access": address_id,
            },
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      address: newAddress,
      message: "Address added successfully",
    });
  } catch (error) {
    console.error("Error adding address:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
