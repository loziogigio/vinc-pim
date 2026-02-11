/**
 * Tag-to-Customers API
 *
 * GET    /api/b2b/customer-tags/[tag_id]/customers - List customers assigned to this tag
 * PUT    /api/b2b/customer-tags/[tag_id]/customers - Assign tag to a customer
 * DELETE /api/b2b/customer-tags/[tag_id]/customers - Remove tag from a specific customer
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { upsertTagRef } from "@/lib/services/tag-pricing.service";

type RouteContext = { params: Promise<{ tag_id: string }> };

async function getAuth() {
  const session = await getB2BSession();
  if (!session?.isLoggedIn || !session.tenantId) return null;
  return { tenantId: session.tenantId, tenantDb: `vinc-${session.tenantId}` };
}

/**
 * GET /api/b2b/customer-tags/[tag_id]/customers?page=1&limit=20&search=...&include_addresses=1
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tag_id } = await params;
  const { CustomerTag, Customer } = await connectWithModels(auth.tenantDb);

  const tag = await CustomerTag.findOne({ tag_id, is_active: true }).lean();
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const fullTag = (tag as { full_tag: string }).full_tag;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const search = searchParams.get("search") || "";
  const includeAddresses = searchParams.get("include_addresses") === "1";
  const skip = (page - 1) * limit;

  // Customers with this tag at customer level
  const query: Record<string, unknown> = {
    tenant_id: auth.tenantId,
    "tags.full_tag": fullTag,
  };

  if (search) {
    query.$or = [
      { company_name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { first_name: { $regex: search, $options: "i" } },
      { last_name: { $regex: search, $options: "i" } },
      { customer_id: { $regex: search, $options: "i" } },
      { public_code: { $regex: search, $options: "i" } },
      { external_code: { $regex: search, $options: "i" } },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(query)
      .select("customer_id email company_name first_name last_name customer_type public_code external_code")
      .skip(skip)
      .limit(limit)
      .sort({ company_name: 1, email: 1 })
      .lean(),
    Customer.countDocuments(query),
  ]);

  const result: Record<string, unknown> = {
    success: true,
    customers,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };

  // Optionally include addresses with this tag as override
  if (includeAddresses) {
    const addressDocs = await Customer.find(
      {
        tenant_id: auth.tenantId,
        "addresses.tag_overrides.full_tag": fullTag,
      },
      {
        customer_id: 1,
        company_name: 1,
        first_name: 1,
        last_name: 1,
        email: 1,
        addresses: 1,
      }
    )
      .limit(100)
      .lean();

    const addressOverrides: {
      customer_id: string;
      customer_name: string;
      address_id: string;
      address_label: string;
    }[] = [];

    for (const doc of addressDocs) {
      const cName =
        (doc as { company_name?: string }).company_name ||
        [(doc as { first_name?: string }).first_name, (doc as { last_name?: string }).last_name]
          .filter(Boolean)
          .join(" ") ||
        (doc as { email: string }).email;

      for (const addr of (doc as { addresses: Array<{
        address_id: string;
        label?: string;
        recipient_name: string;
        city: string;
        tag_overrides: Array<{ full_tag: string }>;
      }> }).addresses || []) {
        if (addr.tag_overrides?.some((t) => t.full_tag === fullTag)) {
          addressOverrides.push({
            customer_id: (doc as { customer_id: string }).customer_id,
            customer_name: cName,
            address_id: addr.address_id,
            address_label: addr.label || `${addr.recipient_name}, ${addr.city}`,
          });
        }
      }
    }

    result.address_overrides = addressOverrides;
  }

  return NextResponse.json(result);
}

/**
 * PUT /api/b2b/customer-tags/[tag_id]/customers
 * Assign tag to a customer.
 * Body: { customer_id }
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tag_id } = await params;
  const body = await req.json();
  const { customer_id } = body;

  if (!customer_id) {
    return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  }

  const { CustomerTag, Customer } = await connectWithModels(auth.tenantDb);

  const tag = await CustomerTag.findOne({ tag_id, is_active: true }).lean();
  if (!tag) {
    return NextResponse.json({ error: "Tag not found or inactive" }, { status: 404 });
  }

  const tagData = tag as {
    tag_id: string;
    full_tag: string;
    prefix: string;
    code: string;
  };

  const tagRef = {
    tag_id: tagData.tag_id,
    full_tag: tagData.full_tag,
    prefix: tagData.prefix,
    code: tagData.code,
  };

  const customer = await Customer.findOne({
    customer_id,
    tenant_id: auth.tenantId,
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const updatedTags = upsertTagRef(customer.tags || [], tagRef);

  await Customer.updateOne(
    { customer_id, tenant_id: auth.tenantId },
    { $set: { tags: updatedTags } }
  );

  // Update customer_count
  const count = await Customer.countDocuments({
    tenant_id: auth.tenantId,
    "tags.full_tag": tagData.full_tag,
  });
  await CustomerTag.updateOne({ tag_id }, { $set: { customer_count: count } });

  return NextResponse.json({
    success: true,
    customer_count: count,
    message: `Tag assigned to customer ${customer_id}`,
  });
}

/**
 * DELETE /api/b2b/customer-tags/[tag_id]/customers
 * Remove tag from a specific customer.
 * Body: { customer_id }
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tag_id } = await params;
  const body = await req.json();
  const { customer_id } = body;

  if (!customer_id) {
    return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  }

  const { CustomerTag, Customer } = await connectWithModels(auth.tenantDb);

  const tag = await CustomerTag.findOne({ tag_id }).lean();
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const fullTag = (tag as { full_tag: string }).full_tag;

  const result = await Customer.findOneAndUpdate(
    { customer_id, tenant_id: auth.tenantId },
    { $pull: { tags: { full_tag: fullTag } } },
    { new: true }
  );

  if (!result) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Update customer_count
  const count = await Customer.countDocuments({
    tenant_id: auth.tenantId,
    "tags.full_tag": fullTag,
  });
  await CustomerTag.updateOne({ tag_id }, { $set: { customer_count: count } });

  return NextResponse.json({
    success: true,
    customer_count: count,
    message: `Tag removed from customer ${customer_id}`,
  });
}
