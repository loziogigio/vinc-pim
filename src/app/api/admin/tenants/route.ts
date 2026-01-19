/**
 * /api/admin/tenants
 *
 * GET  - List all tenants
 * POST - Create a new tenant (with full provisioning)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import {
  listTenants,
  createTenant,
  CreateTenantInput,
} from "@/lib/services/admin-tenant.service";

/**
 * GET /api/admin/tenants
 * List all tenants
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const tenants = await listTenants();

    return NextResponse.json({
      success: true,
      tenants,
      count: tenants.length,
    });
  } catch (error) {
    console.error("List tenants error:", error);
    return NextResponse.json(
      { error: "Failed to list tenants" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tenants
 * Create a new tenant with full provisioning
 *
 * Body:
 * - tenant_id: string (required) - Unique slug (e.g., "acme-corp")
 * - name: string (required) - Display name
 * - admin_email: string (required) - Initial admin email
 * - admin_password: string (required) - Initial admin password
 * - admin_name?: string - Initial admin name (defaults to tenant name)
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const { tenant_id, name, admin_email, admin_password, admin_name } = body;

    // Validate required fields
    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!admin_email) {
      return NextResponse.json(
        { error: "admin_email is required" },
        { status: 400 }
      );
    }
    if (!admin_password) {
      return NextResponse.json(
        { error: "admin_password is required" },
        { status: 400 }
      );
    }
    if (admin_password.length < 8) {
      return NextResponse.json(
        { error: "admin_password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const input: CreateTenantInput = {
      tenant_id,
      name,
      admin_email,
      admin_password,
      admin_name,
      created_by: auth.admin.email,
    };

    const result = await createTenant(input);

    return NextResponse.json({
      success: true,
      tenant: result.tenant,
      access_url: result.access_url,
      message: `Tenant '${tenant_id}' created successfully with MongoDB database, Solr core, and initial admin user`,
    });
  } catch (error) {
    console.error("Create tenant error:", error);
    const message = error instanceof Error ? error.message : "Failed to create tenant";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
