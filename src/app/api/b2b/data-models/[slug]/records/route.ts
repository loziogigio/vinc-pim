/**
 * GET  /api/b2b/data-models/[slug]/records       — list records (filters/pagination)
 * POST /api/b2b/data-models/[slug]/records       — create one record
 *
 * For `single` cardinality OR when the definition declares an external_ref
 * field, POST behaves as an UPSERT keyed by `(relation_id, channel)` or
 * `(relation_id, channel, external_ref)` respectively.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { loadDefinition } from "@/lib/data-models/load-definition";
import { parseListQuery } from "@/lib/data-models/parse-filters";
import {
  extractExternalRef,
  validateRecordData,
  ValidationError,
} from "@/lib/data-models/validate-record";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const loaded = await loadDefinition(auth.tenantDb, slug, { requireEnabled: false });
    if (!loaded.ok) return loaded.response;
    const { definition, RecordModel } = loaded.loaded;

    const url = new URL(req.url);
    const list = parseListQuery(url, definition.fields);

    const filter: Record<string, unknown> = { ...list.filter };

    const relationId = url.searchParams.get("relation_id");
    if (relationId) filter.relation_id = relationId;

    const channel = url.searchParams.get("channel");
    if (channel) {
      filter.channel = channel;
    } else if (definition.channel !== "*") {
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
    console.error("[GET .../records]", error);
    const message = error instanceof Error ? error.message : "Failed to list records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const loaded = await loadDefinition(auth.tenantDb, slug);
    if (!loaded.ok) return loaded.response;
    const { definition, RecordModel } = loaded.loaded;

    const body = await req.json();
    const relationId = String(body?.relation_id ?? "").trim();
    if (!relationId) {
      return NextResponse.json({ error: "relation_id is required" }, { status: 400 });
    }

    const channel = resolveChannel(body?.channel, definition.channel);
    if (!channel.ok) return channel.response;

    let coerced: Record<string, unknown>;
    try {
      coerced = validateRecordData(body?.data, definition.fields, { strict: true });
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ error: e.message, path: e.path }, { status: 400 });
      }
      throw e;
    }

    const externalRef = extractExternalRef(coerced, definition.external_ref_field);

    // Upsert vs insert based on cardinality / external_ref
    if (
      definition.cardinality === "single" ||
      definition.external_ref_field !== undefined
    ) {
      const matchFilter: Record<string, unknown> = {
        relation_id: relationId,
        channel: channel.value,
      };
      if (definition.external_ref_field) {
        if (!externalRef) {
          return NextResponse.json(
            {
              error: `Field "${definition.external_ref_field}" (the external_ref) is required to upsert`,
            },
            { status: 400 }
          );
        }
        matchFilter.external_ref = externalRef;
      }

      const doc = await RecordModel.findOneAndUpdate(
        matchFilter,
        {
          $set: {
            relation_id: relationId,
            channel: channel.value,
            external_ref: externalRef,
            data: coerced,
            source: typeof body?.source === "string" ? body.source : undefined,
            imported_at: body?.imported_at ? new Date(body.imported_at) : new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return NextResponse.json({ success: true, data: doc }, { status: 201 });
    }

    // 1:N without external_ref — plain insert
    const doc = await RecordModel.create({
      relation_id: relationId,
      channel: channel.value,
      external_ref: externalRef,
      data: coerced,
      source: typeof body?.source === "string" ? body.source : undefined,
      imported_at: body?.imported_at ? new Date(body.imported_at) : undefined,
    });
    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    console.error("[POST .../records]", error);
    const message = error instanceof Error ? error.message : "Failed to create record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolveChannel(
  rawChannel: unknown,
  definitionChannel: string
): { ok: true; value: string } | { ok: false; response: NextResponse } {
  const supplied = typeof rawChannel === "string" && rawChannel.trim();
  if (!supplied) {
    if (definitionChannel === "*") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "channel is required when the data model's channel is '*'" },
          { status: 400 }
        ),
      };
    }
    return { ok: true, value: definitionChannel };
  }
  if (definitionChannel !== "*" && supplied !== definitionChannel) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `channel "${supplied}" does not match the model's channel "${definitionChannel}"`,
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, value: supplied };
}
