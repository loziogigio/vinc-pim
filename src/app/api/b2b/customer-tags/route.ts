/**
 * Customer Tags CRUD API
 *
 * GET  /api/b2b/customer-tags - List all customer tags (optionally filter by prefix)
 * POST /api/b2b/customer-tags - Create a new customer tag
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { buildFullTag, isValidPrefix, isValidCode } from "@/lib/constants/customer-tag";

async function getAuth() {
  const session = await getB2BSession();
  if (!session?.isLoggedIn || !session.tenantId) return null;
  return { tenantId: session.tenantId, tenantDb: `vinc-${session.tenantId}` };
}

/**
 * GET /api/b2b/customer-tags?prefix=categoria-di-sconto
 */
export async function GET(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { CustomerTag } = await connectWithModels(auth.tenantDb);
  const { searchParams } = new URL(req.url);
  const prefix = searchParams.get("prefix");

  const query: Record<string, unknown> = { is_active: true };
  if (prefix) query.prefix = prefix;

  const tags = await CustomerTag.find(query).sort({ prefix: 1, code: 1 }).lean();

  return NextResponse.json({ success: true, tags });
}

/**
 * POST /api/b2b/customer-tags
 * Body: { prefix, code, description, color? }
 */
export async function POST(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { prefix, code, description, color } = body;

  if (!prefix || !code || !description) {
    return NextResponse.json(
      { error: "prefix, code, and description are required" },
      { status: 400 },
    );
  }

  if (!isValidPrefix(prefix)) {
    return NextResponse.json(
      { error: "Invalid prefix format (lowercase kebab-case required)" },
      { status: 400 },
    );
  }

  if (!isValidCode(code)) {
    return NextResponse.json(
      { error: "Invalid code format (lowercase kebab-case required)" },
      { status: 400 },
    );
  }

  const { CustomerTag } = await connectWithModels(auth.tenantDb);
  const full_tag = buildFullTag(prefix, code);

  // Check for duplicate
  const existing = await CustomerTag.findOne({ full_tag });
  if (existing) {
    return NextResponse.json(
      { error: `Tag already exists: ${full_tag}` },
      { status: 409 },
    );
  }

  const tag = await CustomerTag.create({
    prefix,
    code,
    full_tag,
    description: description.trim(),
    color: color || undefined,
  });

  return NextResponse.json({ success: true, tag }, { status: 201 });
}
