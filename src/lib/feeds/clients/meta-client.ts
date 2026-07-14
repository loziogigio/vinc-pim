/**
 * Meta Catalog Batch API client — items_batch pushes with per-item
 * validation-error mapping. Endpoint env-overridable for tests.
 */
import type { FeedProduct } from "../canonical";
import { toMetaBatchRequest, toMetaDeleteRequest } from "../adapters/meta";
import type { FeedPushResult } from "./google-client";

const API_BASE =
  process.env.FEEDS_META_API_BASE || "https://graph.facebook.com/v21.0";
const CHUNK_SIZE = 100;

export interface MetaClientConfig {
  catalogId: string;
  accessToken: string;
}

export class MetaCatalogClient {
  private cfg: MetaClientConfig;

  constructor(cfg: MetaClientConfig) {
    this.cfg = cfg;
  }

  private async sendBatch(
    codes: string[],
    requests: Record<string, unknown>[]
  ): Promise<FeedPushResult[]> {
    const results: FeedPushResult[] = [];
    for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
      const chunkCodes = codes.slice(i, i + CHUNK_SIZE);
      const chunk = requests.slice(i, i + CHUNK_SIZE);
      try {
        const body = new URLSearchParams({
          access_token: this.cfg.accessToken,
          item_type: "PRODUCT_ITEM",
          requests: JSON.stringify(chunk),
        });
        const res = await fetch(`${API_BASE}/${this.cfg.catalogId}/items_batch`, {
          method: "POST",
          body,
        });
        if (!res.ok) {
          const text = await res.text();
          const error = `HTTP ${res.status}: ${text.slice(0, 500)}`;
          results.push(...chunkCodes.map((c) => ({ entity_code: c, ok: false, error })));
          continue;
        }
        const json = (await res.json()) as {
          validation_status?: {
            retailer_id: string;
            errors?: { message: string }[];
          }[];
        };
        const errorsByCode = new Map<string, string>();
        for (const v of json.validation_status ?? []) {
          if (v.errors?.length) {
            errorsByCode.set(v.retailer_id, v.errors.map((e) => e.message).join("; "));
          }
        }
        results.push(
          ...chunkCodes.map((c) =>
            errorsByCode.has(c)
              ? { entity_code: c, ok: false, error: errorsByCode.get(c) }
              : { entity_code: c, ok: true }
          )
        );
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push(...chunkCodes.map((c) => ({ entity_code: c, ok: false, error })));
      }
    }
    return results;
  }

  async pushProducts(products: FeedProduct[]): Promise<FeedPushResult[]> {
    return this.sendBatch(
      products.map((p) => p.entity_code),
      products.map((p) => toMetaBatchRequest(p))
    );
  }

  async deleteProducts(entityCodes: string[]): Promise<FeedPushResult[]> {
    return this.sendBatch(
      entityCodes,
      entityCodes.map((c) => toMetaDeleteRequest(c))
    );
  }
}
