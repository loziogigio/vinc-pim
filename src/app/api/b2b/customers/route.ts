import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { validateLegalInfo } from "@/lib/db/models/customer";
import { getNextCustomerPublicCode } from "@/lib/db/models/counter";
import { nanoid } from "nanoid";
import type { CreateCustomerRequest } from "@/lib/types/customer";
import { upsertCustomerTagsBatch } from "@/lib/services/tag-pricing.service";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getPortalUserFromRequest,
  getAccessibleCustomerIds,
} from "@/lib/auth/portal-user-token";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import { DEFAULT_CHANNEL, isValidChannelCode } from "@/lib/constants/channel";

/**
 * Authenticate request via session or API key
 * Also checks for portal user token and returns customer access restrictions
 * Returns tenant-specific models from connection pool
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  models?: Awaited<ReturnType<typeof connectWithModels>>;
  customerAccess?: ICustomerAccess[];
  portalUserId?: string;
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
        error: apiKeyResult.error,
        statusCode: apiKeyResult.statusCode,
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

  // Get tenant-specific models from connection pool
  const models = await connectWithModels(tenantDb);

  // Check for portal user token (additional access restriction)
  const portalUser = await getPortalUserFromRequest(req, tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    models,
    customerAccess: portalUser?.customerAccess,
    portalUserId: portalUser?.portalUserId,
  };
}

/**
 * GET /api/b2b/customers
 * List customers with pagination and filters
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel, Order: OrderModel } = auth.models;

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const customerType = searchParams.get("customer_type");
    const isGuest = searchParams.get("is_guest");
    const search = searchParams.get("search");
    const customerCode = searchParams.get("customer_code");
    const addressCode = searchParams.get("address_code");

    // Build query
    const query: Record<string, unknown> = { tenant_id: tenantId };

    // If portal user, restrict to accessible customers only
    if (auth.customerAccess && auth.customerAccess.length > 0) {
      const accessibleIds = getAccessibleCustomerIds(auth.customerAccess);
      query.customer_id = { $in: accessibleIds };
    }

    if (customerType) {
      query.customer_type = customerType;
    }

    if (isGuest !== null && isGuest !== undefined) {
      query.is_guest = isGuest === "true";
    }

    // Exact match on customer external_code
    if (customerCode) {
      query.external_code = customerCode;
    }

    // Exact match on address external_code
    if (addressCode) {
      query["addresses.external_code"] = addressCode;
    }

    // Search across email, name, company, and codes
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { first_name: { $regex: search, $options: "i" } },
        { last_name: { $regex: search, $options: "i" } },
        { company_name: { $regex: search, $options: "i" } },
        { external_code: { $regex: search, $options: "i" } },
        { public_code: { $regex: search, $options: "i" } },
      ];
    }

    // Execute query with pagination
    const [customers, total] = await Promise.all([
      CustomerModel.find(query)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerModel.countDocuments(query),
    ]);

    // Get order stats for each customer
    const customerIds = customers.map((c: { customer_id: string }) => c.customer_id);
    const orderStats = await OrderModel.aggregate([
      { $match: { customer_id: { $in: customerIds } } },
      {
        $group: {
          _id: "$customer_id",
          order_count: { $sum: 1 },
          total_spent: { $sum: "$order_total" },
          last_order_date: { $max: "$created_at" },
          draft_count: {
            $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
          },
        },
      },
    ]);

    // Create a map for quick lookup
    const statsMap = new Map(
      orderStats.map((s: { _id: string; order_count: number; total_spent: number; last_order_date: Date | null; draft_count: number }) => [
        s._id,
        {
          order_count: s.order_count,
          total_spent: s.total_spent,
          last_order_date: s.last_order_date,
          draft_count: s.draft_count,
        },
      ])
    );

    // Enrich customers with order stats
    const customersWithStats = customers.map((customer: { customer_id: string }) => ({
      ...customer,
      order_stats: statsMap.get(customer.customer_id) || {
        order_count: 0,
        total_spent: 0,
        last_order_date: null,
        draft_count: 0,
      },
    }));

    return NextResponse.json({
      success: true,
      customers: customersWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/customers
 * Create a new customer
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const tenant_id = auth.tenantId!;
    const { Customer: CustomerModel, PortalUser: PortalUserModel } = auth.models;

    const body: CreateCustomerRequest = await req.json();

    // Validate required fields
    if (!body.customer_type) {
      return NextResponse.json(
        { error: "customer_type is required" },
        { status: 400 }
      );
    }

    if (!body.email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // Validate channel if provided
    if (body.channel && !isValidChannelCode(body.channel)) {
      return NextResponse.json(
        { error: "Invalid channel code (e.g. B2C, SLOVAKIA)" },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingCustomer = await CustomerModel.findOne({
      tenant_id,
      email: body.email,
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Customer with this email already exists" },
        { status: 409 }
      );
    }

    // Validate legal info if provided
    if (body.legal_info) {
      const validation = validateLegalInfo(body.legal_info);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Invalid legal info", details: validation.errors },
          { status: 400 }
        );
      }
    }

    // Generate customer ID
    const customer_id = nanoid(12);

    // Auto-generate public_code if not provided
    const public_code = body.public_code || await getNextCustomerPublicCode(auth.tenantDb!);

    // Process addresses - generate IDs
    const addresses = (body.addresses || []).map((addr) => {
      const address_id = nanoid(8);
      return {
        ...addr,
        address_id,
        external_code: addr.external_code || address_id,
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

    // Find default addresses
    let default_shipping_address_id: string | undefined;
    let default_billing_address_id: string | undefined;

    for (const addr of addresses) {
      if (addr.is_default) {
        if (addr.address_type === "delivery" || addr.address_type === "both") {
          default_shipping_address_id = addr.address_id;
        }
        if (addr.address_type === "billing" || addr.address_type === "both") {
          default_billing_address_id = addr.address_id;
        }
      }
    }

    // Create customer
    const customer = await CustomerModel.create({
      customer_id,
      tenant_id,
      customer_type: body.customer_type,
      is_guest: body.is_guest ?? false,
      channel: body.channel || DEFAULT_CHANNEL,
      email: body.email,
      external_code: body.external_code || customer_id,
      public_code,
      phone: body.phone,
      first_name: body.first_name,
      last_name: body.last_name,
      company_name: body.company_name,
      legal_info: body.legal_info,
      addresses,
      default_shipping_address_id,
      default_billing_address_id,
    });

    // Upsert customer-level tags if provided
    if (body.tags && body.tags.length > 0) {
      await upsertCustomerTagsBatch(auth.tenantDb!, tenant_id, customer_id, body.tags);
    }

    // Auto-assign customer to portal user if they created it
    if (auth.portalUserId) {
      await PortalUserModel.updateOne(
        { portal_user_id: auth.portalUserId, tenant_id },
        {
          $push: {
            customer_access: {
              customer_id,
              address_access: "all",
            },
          },
        }
      );
    }

    // Re-fetch to include tags if they were applied
    const finalCustomer = (body.tags && body.tags.length > 0)
      ? await CustomerModel.findOne({ customer_id, tenant_id }).lean() || customer
      : customer;

    return NextResponse.json({ success: true, customer: finalCustomer }, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
