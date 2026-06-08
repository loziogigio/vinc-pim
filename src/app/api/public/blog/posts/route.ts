import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getTenantDefaultLanguageCode } from "@/lib/services/tenant-languages";

/**
 * GET /api/public/blog/posts — list published posts for a channel + locale.
 * Tenant resolved via x-resolved-tenant-db header (no auth).
 */
export async function GET(req: NextRequest) {
  try {
    const tenantDb = req.headers.get("x-resolved-tenant-db");
    if (!tenantDb) return NextResponse.json({ error: "Tenant not resolved" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel") || "default";
    const locale = searchParams.get("locale") || (await getTenantDefaultLanguageCode(tenantDb));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const { BlogPost } = await connectWithModels(tenantDb);
    const query = { channels: channel, translations: { $elemMatch: { locale, status: "published" } } };

    const total = await BlogPost.countDocuments(query);
    const docs: any[] = await BlogPost.find(query).sort({ updated_at: -1 }).skip((page - 1) * limit).limit(limit).lean();

    const items = docs.map((d) => {
      const tr = d.translations.find((t: any) => t.locale === locale);
      return {
        slug: d.slug, locale, title: tr?.title ?? "", excerpt: tr?.excerpt ?? null,
        published_at: tr?.published_at ?? null, cover_image: d.cover_image ?? null,
        category_ids: d.category_ids, tag_ids: d.tag_ids,
      };
    });

    return NextResponse.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    console.error("[public blog list]", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
