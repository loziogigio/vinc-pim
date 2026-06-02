/**
 * Customer Tags CRUD API
 *
 * GET    /api/b2b/customer-tags - List all customer tags (optionally filter by prefix)
 * POST   /api/b2b/customer-tags - Create a new customer tag
 * DELETE /api/b2b/customer-tags - Delete a tag definition (blocked if customers assigned)
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import {
  buildFullTag,
  isValidPrefix,
  isValidCode,
} from "@/lib/constants/customer-tag";
import { safeRegexQuery } from "@/lib/security";
import { getTagAuth } from "./_auth";

/**
 * GET /api/b2b/customer-tags?prefix=categoria-di-sconto
 */
export async function GET(req: NextRequest) {
  const auth = await getTagAuth();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { CustomerTag } = await connectWithModels(auth.tenantDb);
  const { searchParams } = new URL(req.url);
  const prefix = searchParams.get("prefix");
  const search = searchParams.get("search")?.trim();

  const query: Record<string, unknown> = { is_active: true };
  if (prefix) query.prefix = prefix;
  // Server-side search across code / full tag / description / prefix.
  if (search) {
    const rx = safeRegexQuery(search);
    query.$or = [
      { code: rx },
      { full_tag: rx },
      { description: rx },
      { prefix: rx },
    ];
  }

  // Tags are rendered grouped by prefix (a bounded vocabulary), so the matching
  // set is returned in full; the dashboard counts are aggregated server-side
  // over ALL active tags (not narrowed by the search box).
  const [tags, statsAgg] = await Promise.all([
    CustomerTag.find(query).sort({ prefix: 1, code: 1 }).lean(),
    CustomerTag.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalAssignments: { $sum: { $ifNull: ["$customer_count", 0] } },
          prefixes: { $addToSet: "$prefix" },
        },
      },
      {
        $project: {
          _id: 0,
          total: 1,
          totalAssignments: 1,
          prefixCount: { $size: "$prefixes" },
        },
      },
    ]),
  ]);

  return NextResponse.json({
    success: true,
    tags,
    stats: statsAgg[0] || { total: 0, totalAssignments: 0, prefixCount: 0 },
  });
}

/**
 * POST /api/b2b/customer-tags
 * Body: { prefix, code, description, color? }
 */
export async function POST(req: NextRequest) {
  const auth = await getTagAuth();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

/**
 * DELETE /api/b2b/customer-tags
 * Body: { tag_id: string }
 * Blocked if any customers are assigned to this tag.
 */
export async function DELETE(req: NextRequest) {
  const auth = await getTagAuth();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tag_id } = body;

  if (!tag_id) {
    return NextResponse.json({ error: "tag_id is required" }, { status: 400 });
  }

  const { CustomerTag } = await connectWithModels(auth.tenantDb);

  const tag = await CustomerTag.findOne({ tag_id }).lean();
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  if (tag.customer_count > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete tag "${tag.full_tag}" — it is assigned to ${tag.customer_count} customer(s). Remove the tag from all customers first.`,
      },
      { status: 400 },
    );
  }

  await CustomerTag.deleteOne({ tag_id });

  return NextResponse.json({ success: true });
}
