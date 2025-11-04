import { NextResponse } from "next/server";
import { cache } from "@/lib/db/cache";
import { getPageConfig } from "@/lib/db/pages";
import { pageConfigSchema } from "@/lib/validation/blockSchemas";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { consumeRateLimit, getClientKey } from "@/lib/security/rateLimiter";
import type { PageConfig } from "@/lib/types/blocks";
import { getOrCreateTemplate } from "@/lib/db/product-templates-simple";
import { ProductTemplateModel } from "@/lib/db/models/product-template-simple";

const PREVIEW_TTL_SECONDS = 60 * 10; // 10 minutes

const cacheKey = (slug: string) => `preview:${slug}`;

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await hasHomeBuilderAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "home";

  const draft = await cache.get<PageConfig>(cacheKey(slug));
  if (!draft) {
    const fallback = await getPageConfig(slug);
    if (!fallback) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    return NextResponse.json(fallback);
  }

  return NextResponse.json(draft);
}

export async function POST(request: Request) {
  if (!(await hasHomeBuilderAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await consumeRateLimit(`pages-preview:${getClientKey(request)}`);
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const payload = await request.json();
  const result = pageConfigSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
  }

  // Save to cache (old system)
  await cache.set(cacheKey(result.data.slug), result.data, PREVIEW_TTL_SECONDS);

  // Also save to new template system if it's a product template
  // Format: product-{sku} or product-detail-{sku}
  const slug = result.data.slug;
  if (slug.startsWith('product-detail-') || slug.startsWith('product-')) {
    const sku = slug.replace('product-detail-', '').replace('product-', '');

    if (sku && result.data.versions.length > 0) {
      try {
        // Ensure template exists
        await getOrCreateTemplate('sku', sku);

        // Get the latest version data
        const latestVersion = result.data.versions[result.data.versions.length - 1];

        // Use updateOne to modify the template
        await ProductTemplateModel.updateOne(
          {
            "matchRules.type": 'sku',
            "matchRules.value": sku
          },
          {
            $set: {
              "versions.0": latestVersion,
              currentVersion: latestVersion.version,
              updatedAt: new Date()
            }
          },
          { upsert: false }
        );
      } catch (err) {
        console.error('Failed to save preview to new template system:', err);
        // Don't fail the whole request if new system fails
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await hasHomeBuilderAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await consumeRateLimit(`pages-preview:${getClientKey(request)}:delete`);
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "home";
  await cache.del(cacheKey(slug));
  return NextResponse.json({ ok: true });
}
