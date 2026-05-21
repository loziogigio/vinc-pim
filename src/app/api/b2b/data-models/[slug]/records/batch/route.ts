/**
 * POST /api/b2b/data-models/[slug]/records/batch
 *
 * Bulk upsert. Body shape mirrors doc/export/time-to-pim/docs/erp-order-history-endpoint.md:
 * {
 *   merge_mode: "partial" | "replace",
 *   source?:    string,
 *   batch_metadata?: { batch_id, batch_part, batch_total_parts, batch_total_items },
 *   records: [
 *     { relation_id, channel?, data, external_ref?, imported_at? },
 *     ...
 *   ]
 * }
 *
 * - "partial" (default): upsert each record by (relation_id, channel,
 *   external_ref) when the model declares an external_ref field, else by
 *   (relation_id, channel) for 1:1 cardinality, else plain insert.
 * - "replace": for each unique (relation_id, channel) in the payload, delete
 *   all existing records first, then insert the supplied ones.
 *
 * Per-record errors are collected; the call returns 200 even when some
 * records fail (look at `errors[]`).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { loadDefinition } from "@/lib/data-models/load-definition";
import {
  extractExternalRef,
  validateRecordData,
  ValidationError,
} from "@/lib/data-models/validate-record";

type RouteParams = { params: Promise<{ slug: string }> };

interface BatchRecord {
  relation_id?: unknown;
  channel?: unknown;
  data?: unknown;
  external_ref?: unknown;
  imported_at?: unknown;
}

const MAX_BATCH_SIZE = 500;

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const loaded = await loadDefinition(auth.tenantDb, slug);
    if (!loaded.ok) return loaded.response;
    const { definition, RecordModel } = loaded.loaded;

    const body = await req.json();
    const mergeMode: "partial" | "replace" =
      body?.merge_mode === "replace" ? "replace" : "partial";
    const source: string | undefined =
      typeof body?.source === "string" ? body.source : undefined;
    const records: BatchRecord[] = Array.isArray(body?.records) ? body.records : [];

    if (records.length === 0) {
      return NextResponse.json({ error: "records[] is required" }, { status: 400 });
    }
    if (records.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size ${records.length} exceeds max ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }

    // Validate every record up front; collect per-record errors.
    interface Prepared {
      index: number;
      relation_id: string;
      channel: string;
      data: Record<string, unknown>;
      external_ref?: string;
      imported_at: Date;
    }

    const prepared: Prepared[] = [];
    const errors: Array<{ index: number; error: string; path?: string }> = [];
    const seenExternalRefs = new Set<string>(); // detect duplicates within the payload

    for (let i = 0; i < records.length; i++) {
      const r = records[i];

      const relationId =
        typeof r?.relation_id === "string" ? r.relation_id.trim() : "";
      if (!relationId) {
        errors.push({ index: i, error: "relation_id is required" });
        continue;
      }

      const channel = resolveChannel(r?.channel, definition.channel);
      if (channel.ok === false) {
        errors.push({ index: i, error: channel.error });
        continue;
      }

      let coerced: Record<string, unknown>;
      try {
        coerced = validateRecordData(r?.data, definition.fields, { strict: true });
      } catch (e) {
        if (e instanceof ValidationError) {
          errors.push({ index: i, error: e.message, path: e.path });
          continue;
        }
        errors.push({
          index: i,
          error: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      let externalRef: string | undefined;
      if (definition.external_ref_field) {
        externalRef =
          typeof r?.external_ref === "string" && r.external_ref.trim()
            ? r.external_ref.trim()
            : extractExternalRef(coerced, definition.external_ref_field);
        if (!externalRef) {
          errors.push({
            index: i,
            error: `external_ref (or field "${definition.external_ref_field}") is required`,
          });
          continue;
        }
        const refKey = `${relationId}|${channel.value}|${externalRef}`;
        if (seenExternalRefs.has(refKey)) {
          errors.push({
            index: i,
            error: `Duplicate external_ref within payload: ${externalRef}`,
          });
          continue;
        }
        seenExternalRefs.add(refKey);
      }

      const importedAt =
        r?.imported_at && !Number.isNaN(new Date(r.imported_at as string).getTime())
          ? new Date(r.imported_at as string)
          : new Date();

      prepared.push({
        index: i,
        relation_id: relationId,
        channel: channel.value,
        data: coerced,
        external_ref: externalRef,
        imported_at: importedAt,
      });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // "replace" — wipe all rows for each (relation_id, channel) in the payload
    if (mergeMode === "replace" && prepared.length > 0) {
      const pairs = new Map<string, { relation_id: string; channel: string }>();
      for (const p of prepared) {
        pairs.set(`${p.relation_id}|${p.channel}`, {
          relation_id: p.relation_id,
          channel: p.channel,
        });
      }
      for (const pair of pairs.values()) {
        const result = await RecordModel.deleteMany(pair);
        deletedCount += result.deletedCount ?? 0;
      }
    }

    // Write
    const useUpsert =
      definition.cardinality === "single" || definition.external_ref_field !== undefined;

    for (const p of prepared) {
      try {
        if (useUpsert) {
          const matchFilter: Record<string, unknown> = {
            relation_id: p.relation_id,
            channel: p.channel,
          };
          if (definition.external_ref_field) {
            matchFilter.external_ref = p.external_ref;
          }

          const result = await RecordModel.findOneAndUpdate(
            matchFilter,
            {
              $set: {
                relation_id: p.relation_id,
                channel: p.channel,
                external_ref: p.external_ref,
                data: p.data,
                source,
                imported_at: p.imported_at,
              },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true, rawResult: true }
          );

          const raw = result as unknown as {
            lastErrorObject?: { updatedExisting?: boolean; upserted?: unknown };
          };
          if (raw?.lastErrorObject?.upserted) createdCount += 1;
          else updatedCount += 1;
        } else {
          // 1:N without external_ref — plain insert
          await RecordModel.create({
            relation_id: p.relation_id,
            channel: p.channel,
            data: p.data,
            source,
            imported_at: p.imported_at,
          });
          createdCount += 1;
        }
      } catch (e) {
        errors.push({
          index: p.index,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        merge_mode: mergeMode,
        submitted: records.length,
        created: createdCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors,
      },
    });
  } catch (error) {
    console.error("[POST .../records/batch]", error);
    const message = error instanceof Error ? error.message : "Batch import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolveChannel(
  raw: unknown,
  definitionChannel: string
): { ok: true; value: string } | { ok: false; error: string } {
  const supplied = typeof raw === "string" && raw.trim();
  if (!supplied) {
    if (definitionChannel === "*") {
      return {
        ok: false,
        error: "channel is required when the data model's channel is '*'",
      };
    }
    return { ok: true, value: definitionChannel };
  }
  if (definitionChannel !== "*" && supplied !== definitionChannel) {
    return {
      ok: false,
      error: `channel "${supplied}" does not match the model's channel "${definitionChannel}"`,
    };
  }
  return { ok: true, value: supplied };
}
