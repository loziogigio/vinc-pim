/**
 * Feed Sync Engine
 *
 * Executes one sync run for one destination: scan live PIM products
 * (SCD-2 live scope — isCurrent: true is NON-NEGOTIABLE), build canonical
 * FeedProducts, hash-diff against FeedItemState, push changes through the
 * destination client, propagate deletions on full runs, record FeedRun.
 */
import { randomBytes } from "crypto";
import { connectWithModels } from "@/lib/db/connection";
import { decrypt } from "@/lib/utils/encryption";
import { buildFeedProduct, feedContentHash, type FeedProduct } from "./canonical";
import { GoogleMerchantClient, type FeedPushResult } from "./clients/google-client";
import { MetaCatalogClient } from "./clients/meta-client";
import type { IFeedDestination } from "@/lib/db/models/feed-destination";

const PUSH_CHUNK = 200;

export interface FeedSyncSummary {
  run_id: string;
  status: "success" | "partial" | "failed";
  scanned: number;
  pushed: number;
  skipped: number;
  failed: number;
  deleted: number;
}

interface FeedClient {
  pushProducts(products: FeedProduct[]): Promise<FeedPushResult[]>;
  deleteProducts(entityCodes: string[]): Promise<FeedPushResult[]>;
}

/** TrovaPrezzi is pull-based: "pushing" is a no-op success. */
class NullClient implements FeedClient {
  async pushProducts(products: FeedProduct[]): Promise<FeedPushResult[]> {
    return products.map((p) => ({ entity_code: p.entity_code, ok: true }));
  }
  async deleteProducts(codes: string[]): Promise<FeedPushResult[]> {
    return codes.map((c) => ({ entity_code: c, ok: true }));
  }
}

export function buildProductScope(destination: {
  channel: string;
  brand_labels?: string[];
  category_ids?: string[];
  in_stock_only?: boolean;
}): Record<string, unknown> {
  const scope: Record<string, unknown> = {
    status: "published",
    isCurrent: true,
    not_visible: { $ne: true },
    $or: [
      { channels: destination.channel },
      { "channel_categories.channel_code": destination.channel },
    ],
  };
  if (destination.brand_labels?.length) {
    scope["brand.label"] = { $in: destination.brand_labels };
  }
  if (destination.category_ids?.length) {
    scope["category.category_id"] = { $in: destination.category_ids };
  }
  if (destination.in_stock_only) {
    scope.quantity = { $gt: 0 };
  }
  return scope;
}

function buildClient(dest: IFeedDestination): FeedClient {
  if (dest.type === "google_merchant") {
    return new GoogleMerchantClient({
      merchantAccountId: dest.google_merchant_account_id || "",
      serviceAccountJson: decrypt(dest.google_service_account_json_encrypted || ""),
      contentLanguage: dest.lang,
      feedLabel: dest.lang.toUpperCase(),
      dataSource: dest.google_data_source,
    });
  }
  if (dest.type === "meta_catalog") {
    return new MetaCatalogClient({
      catalogId: dest.meta_catalog_id || "",
      accessToken: decrypt(dest.meta_system_user_token_encrypted || ""),
    });
  }
  return new NullClient();
}

export async function runFeedSync(
  tenantDb: string,
  tenantId: string,
  destinationId: string,
  mode: "delta" | "full" | "manual"
): Promise<FeedSyncSummary> {
  const { FeedDestination, FeedRun, FeedItemState, PIMProduct } =
    await connectWithModels(tenantDb);

  const dest = (await FeedDestination.findOne({
    destination_id: destinationId,
  }).lean()) as IFeedDestination | null;
  if (!dest) throw new Error(`Feed destination not found: ${destinationId}`);
  if (dest.status === "paused") {
    return { run_id: "", status: "success", scanned: 0, pushed: 0, skipped: 0, failed: 0, deleted: 0 };
  }

  const runId = `fr_${randomBytes(6).toString("hex")}`;
  await FeedRun.create({ run_id: runId, destination_id: destinationId, mode });

  let scanned = 0;
  let skipped = 0;
  let pushed = 0;
  let failed = 0;
  let deleted = 0;
  let errorSummary = "";

  try {
    // Existing states for hash diffing (delta) and deletion detection (full).
    const states = (await FeedItemState.find({ destination_id: destinationId })
      .select({ entity_code: 1, content_hash: 1, remote_status: 1 })
      .lean()) as { entity_code: string; content_hash: string; remote_status: string }[];
    const stateByCode = new Map(states.map((s) => [s.entity_code, s]));

    const client = buildClient(dest as IFeedDestination);
    const opts = {
      lang: dest.lang,
      channel: dest.channel,
      currency: dest.currency,
      productUrlTemplate: dest.product_url_template,
    };

    const liveCodes = new Set<string>();
    let buffer: { fp: FeedProduct; hash: string }[] = [];

    const flush = async () => {
      if (!buffer.length) return;
      const results = await client.pushProducts(buffer.map((b) => b.fp));
      const byCode = new Map(results.map((r) => [r.entity_code, r]));
      for (const { fp, hash } of buffer) {
        const r = byCode.get(fp.entity_code);
        if (r?.ok) {
          pushed++;
          await FeedItemState.updateOne(
            { destination_id: destinationId, entity_code: fp.entity_code },
            {
              $set: {
                content_hash: hash, remote_status: "pushed",
                last_pushed_at: new Date(), last_error: null, last_run_id: runId,
              },
            },
            { upsert: true }
          );
        } else {
          failed++;
          if (!errorSummary && r?.error) errorSummary = r.error;
          await FeedItemState.updateOne(
            { destination_id: destinationId, entity_code: fp.entity_code },
            {
              $set: {
                content_hash: hash, remote_status: "error",
                last_error: r?.error || "unknown error", last_run_id: runId,
              },
            },
            { upsert: true }
          );
        }
      }
      buffer = [];
    };

    const cursor = PIMProduct.find(buildProductScope(dest)).lean().cursor();
    for await (const product of cursor) {
      scanned++;
      const code = String((product as Record<string, unknown>).entity_code);
      liveCodes.add(code);
      const fp = buildFeedProduct(product as Record<string, unknown>, opts);
      if (!fp) {
        skipped++;
        continue;
      }
      const hash = feedContentHash(fp);
      const prev = stateByCode.get(code);
      if (mode === "delta" && prev && prev.content_hash === hash && prev.remote_status === "pushed") {
        skipped++;
        continue;
      }
      buffer.push({ fp, hash });
      if (buffer.length >= PUSH_CHUNK) await flush();
    }
    await flush();

    // Deletions — only on full/manual reconciles.
    if (mode !== "delta") {
      const vanished = states
        .filter((s) => !liveCodes.has(s.entity_code) && s.remote_status !== "deleted")
        .map((s) => s.entity_code);
      for (let i = 0; i < vanished.length; i += PUSH_CHUNK) {
        const chunk = vanished.slice(i, i + PUSH_CHUNK);
        const results = await client.deleteProducts(chunk);
        for (const r of results) {
          if (r.ok) {
            deleted++;
            await FeedItemState.updateOne(
              { destination_id: destinationId, entity_code: r.entity_code },
              { $set: { remote_status: "deleted", last_run_id: runId } }
            );
          } else {
            failed++;
            if (!errorSummary && r.error) errorSummary = r.error;
          }
        }
      }
      await FeedDestination.updateOne(
        { destination_id: destinationId },
        { $set: { last_full_run_at: new Date() } }
      );
    }
  } catch (err) {
    errorSummary = err instanceof Error ? err.message : String(err);
    failed++;
  }

  const status: FeedSyncSummary["status"] =
    failed === 0 ? "success" : pushed > 0 || deleted > 0 ? "partial" : "failed";

  await FeedRun.updateOne(
    { run_id: runId },
    {
      $set: {
        status, scanned, pushed, skipped, failed, deleted,
        finished_at: new Date(),
        error_summary: errorSummary || undefined,
      },
    }
  );
  await FeedDestination.updateOne(
    { destination_id: destinationId },
    {
      $set: {
        status: status === "failed" ? "error" : "active",
        status_message: status === "failed" ? errorSummary : undefined,
        last_run: {
          run_id: runId, finished_at: new Date(), status, pushed, failed, deleted,
        },
      },
    }
  );

  if (failed > 0 && dest.notification_email) {
    try {
      const { sendNotification } = await import("@/lib/notifications/send.service");
      await sendNotification({
        tenantDb,
        trigger: "custom",
        to: dest.notification_email,
        variables: {
          subject: `Feed sync degraded: ${dest.name}`,
          content_html: `<p>Run ${runId} (${mode}) finished with status <b>${status}</b>.</p><p>pushed=${pushed} failed=${failed} deleted=${deleted} skipped=${skipped}.</p><p>First error: ${errorSummary || "n/a"}</p>`,
        },
      });
    } catch (alertErr) {
      console.error("[feeds] degraded-run alert failed:", alertErr);
    }
  }

  return { run_id: runId, status, scanned, pushed, skipped, failed, deleted };
}
