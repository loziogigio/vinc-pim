/**
 * GET /api/public/feeds/[destinationId]?tenant=<tenantId>&token=<feed_token>
 *
 * Public TrovaPrezzi XML feed. Auth = feed_token match (404 on any
 * mismatch, never reveal existence). 30-min Redis cache per destination.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { buildProductScope } from "@/lib/feeds/feed-sync.service";
import { buildFeedProduct, type FeedProduct } from "@/lib/feeds/canonical";
import { buildTrovaPrezziXml } from "@/lib/feeds/adapters/trovaprezzi";
import type { IFeedDestination } from "@/lib/db/models/feed-destination";

const CACHE_TTL_SECONDS = 1800;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ destinationId: string }> }
) {
  const { destinationId } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenant");
  const token = searchParams.get("token");
  if (!tenantId || !token || !/^[a-z0-9-]+$/.test(tenantId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const tenantDb = `vinc-${tenantId}`;

  try {
    const { FeedDestination, PIMProduct } = await connectWithModels(tenantDb);
    const dest = (await FeedDestination.findOne({
      destination_id: destinationId,
      type: "trovaprezzi",
    }).lean()) as IFeedDestination | null;
    if (!dest || !dest.feed_token || dest.feed_token !== token) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const cacheKey = `feeds:xml:${tenantDb}:${destinationId}`;
    let redis: { get(k: string): Promise<string | null>; set(k: string, v: string, m: string, t: number): Promise<unknown> } | null = null;
    try {
      const { getRedis } = await import("@/lib/cache/redis-client");
      redis = getRedis();
      const cached = await redis?.get(cacheKey);
      if (cached) {
        return new NextResponse(cached, {
          status: 200,
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      }
    } catch {
      redis = null; // cache is best-effort
    }

    const opts = {
      lang: dest.lang,
      channel: dest.channel,
      currency: dest.currency,
      productUrlTemplate: dest.product_url_template,
    };
    const products: FeedProduct[] = [];
    const cursor = PIMProduct.find(buildProductScope(dest)).lean().cursor();
    for await (const doc of cursor) {
      const fp = buildFeedProduct(doc as Record<string, unknown>, opts);
      if (fp) products.push(fp);
    }
    const xml = buildTrovaPrezziXml(products, { shippingCost: dest.shipping_cost });

    try {
      await redis?.set(cacheKey, xml, "EX", CACHE_TTL_SECONDS);
    } catch {
      /* best-effort */
    }

    return new NextResponse(xml, {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch (error) {
    console.error("[GET /api/public/feeds]", error);
    return NextResponse.json({ error: "Feed temporarily unavailable" }, { status: 503 });
  }
}
