/**
 * Product → channel sync service.
 *
 * Propagates a single product to its downstream channels (Solr search index,
 * storefront/marketplace adapters). The synchronous helper is used by the
 * product PATCH route and the manual "Sync to Solr" action so an edit is
 * reflected on the storefront immediately, without waiting on a queue.
 */

import { connectWithModels } from "@/lib/db/connection";
import { initializeAdapters } from "@/lib/adapters";
import { markSolrIndexed } from "@/lib/services/solr-sync-state";
import { syncProductToMarketplaces, getEnabledChannels } from "@/lib/sync/marketplace-sync";

/**
 * Channels synced synchronously (inline) on a product edit. Only direct index
 * writes belong here — Solr. HTTP-push channels (b2b/b2c/marketplaces) are
 * dispatched through the sync queue instead, so a slow third-party API never
 * blocks the edit. Adding a new HTTP adapter therefore never makes "Save" hang.
 */
export const SYNCHRONOUS_SYNC_CHANNELS = ["solr"] as const;

export interface ChannelSyncOutcome {
  channel: string;
  success: boolean;
  message?: string;
}

interface ChannelAdapter {
  name: string;
  syncProduct: (product: any, options?: any) => Promise<{ success: boolean; message?: string }>;
}

/**
 * Pure orchestration core: sync `product` to each of `channels` that has an
 * adapter in `adapters`. Channels run concurrently and independently — one
 * failing channel never blocks the others (Promise.allSettled). Returns a
 * per-channel outcome.
 */
export async function syncProductToChannels(
  product: any,
  adapters: Map<string, ChannelAdapter>,
  channels: readonly string[],
): Promise<ChannelSyncOutcome[]> {
  const targets = channels.filter((c) => adapters.has(c));
  const settled = await Promise.allSettled(
    targets.map((c) => adapters.get(c)!.syncProduct(product)),
  );
  return targets.map((channel, i) => {
    const r = settled[i];
    return r.status === "fulfilled"
      ? { channel, success: r.value.success, message: r.value.message }
      : { channel, success: false, message: (r.reason as Error)?.message };
  });
}

/**
 * Synchronously sync the current published version of a product to its
 * direct-write channels (Solr by default). No queue — resolves once the
 * channels are updated. Best-effort: returns per-channel outcomes and never
 * throws on a channel failure. Drafts and missing products are no-ops.
 *
 * Stamps solr_indexed_at only when Solr acked, so a Solr failure leaves
 * updated_at > solr_indexed_at for the consolidation/gap job to heal.
 */
export async function syncProductToChannelsNow(
  entity_code: string,
  tenantId: string,
  tenantDb: string,
  channels: readonly string[] = SYNCHRONOUS_SYNC_CHANNELS,
): Promise<ChannelSyncOutcome[]> {
  const { PIMProduct } = await connectWithModels(tenantDb);
  const product = await PIMProduct.findOne({ entity_code, isCurrent: true }).lean();
  if (!product || product.status !== "published") return [];

  const adapters = await initializeAdapters(tenantId);
  const outcomes = await syncProductToChannels(product, adapters as any, channels);

  if (outcomes.find((o) => o.channel === "solr")?.success) {
    await markSolrIndexed(PIMProduct as any, [entity_code]);
  }
  return outcomes;
}

/**
 * Propagate a product edit to every enabled downstream channel.
 *
 * Direct-write channels (Solr) sync synchronously, so the storefront's
 * `/search/search` reflects the edit before this resolves. Every other enabled
 * channel (b2b/b2c/marketplaces — HTTP pushes) is dispatched through the sync
 * queue at high priority so a slow third-party API never blocks the edit.
 *
 * Call only for published products; best-effort — the caller wraps it so a
 * channel failure never fails the edit.
 */
export async function propagateProductEdit(
  entity_code: string,
  tenantId: string,
  tenantDb: string,
): Promise<void> {
  await syncProductToChannelsNow(entity_code, tenantId, tenantDb);

  const queued = getEnabledChannels().filter(
    (c) => !(SYNCHRONOUS_SYNC_CHANNELS as readonly string[]).includes(c),
  );
  if (queued.length > 0) {
    await syncProductToMarketplaces(entity_code, {
      tenantId,
      channels: queued,
      operation: "update",
      priority: "high",
    });
  }
}
