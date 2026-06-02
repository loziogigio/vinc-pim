/**
 * GET /api/b2b/me/data/[slug]/records
 *
 * Session-scoped read endpoint for the B2B storefront. Returns records owned
 * by the currently authenticated portal_user / b2b_user. The model must:
 *   - exist and be enabled
 *   - have readable_by_end_user = true
 *   - have a relation that matches the caller's user type
 *   - have a channel that matches "*" or the caller's request channel
 *
 * Writes via this path are NOT supported in v1.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { loadDefinition } from "@/lib/data-models/load-definition";
import { parseListQuery } from "@/lib/data-models/parse-filters";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const loaded = await loadDefinition(auth.tenantDb, slug);
    if (!loaded.ok) return loaded.response;
    const { definition, RecordModel } = loaded.loaded;

    if (!definition.readable_by_end_user) {
      return NextResponse.json(
        { error: "This data model is not readable by end users" },
        { status: 403 }
      );
    }

    if (!relationTypeMatches(definition.relation, auth)) {
      return NextResponse.json(
        {
          error: `This data model is keyed by ${definition.relation}, but you are signed in as ${auth.userType ?? "unknown"}`,
        },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const list = parseListQuery(url, definition.fields);

    const filter: Record<string, unknown> = {
      ...list.filter,
      relation_id: auth.userId,
    };

    const requestedChannel = url.searchParams.get("channel");
    if (definition.channel === "*") {
      if (requestedChannel) filter.channel = requestedChannel;
    } else {
      // For channel-scoped models, ignore any user-supplied channel and pin
      // to the definition's channel (storefront context decides this elsewhere).
      filter.channel = definition.channel;
    }

    const [items, total] = await Promise.all([
      RecordModel.find(filter)
        .sort({ [list.sortBy]: list.sortDir, _id: -1 })
        .skip(list.skip)
        .limit(list.limit)
        .lean(),
      RecordModel.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page: list.page,
          limit: list.limit,
          total,
          totalPages: Math.ceil(total / list.limit),
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/b2b/me/data/:slug/records]", error);
    const message = error instanceof Error ? error.message : "Failed to list records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function relationTypeMatches(
  relation: "portal_user" | "customer",
  auth: { authMethod?: string; userType?: string }
): boolean {
  // Customer-keyed models belong to real storefront customers: userType
  // "b2b_user" (an SSO session carrying `vinc_profile.customers`) reached via a
  // bearer token or API key. Both conditions are required:
  //   - userType "b2b_user" excludes portal_user bearer tokens (also authMethod
  //     "bearer") that are NOT customers;
  //   - authMethod bearer/api-key excludes dashboard cookie sessions (authMethod
  //     "session"), which are internal staff also tagged "b2b_user".
  if (relation === "customer") {
    return auth.userType === "b2b_user" && (auth.authMethod === "bearer" || auth.authMethod === "api-key");
  }
  return auth.userType === "portal_user";
}
