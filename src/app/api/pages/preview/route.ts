import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cache } from "@/lib/db/cache";
import { getPageConfig } from "@/lib/db/pages";
import { pageConfigSchema } from "@/lib/validation/blockSchemas";
import { sessionOptions, type AdminSessionData } from "@/lib/auth/session";
import { consumeRateLimit, getClientKey } from "@/lib/security/rateLimiter";
import type { PageConfig } from "@/lib/types/blocks";

const PREVIEW_TTL_SECONDS = 60 * 10; // 10 minutes

const cacheKey = (slug: string) => `preview:${slug}`;

const assertAdminSession = async () => {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);
  if (!session.isLoggedIn) {
    return null;
  }
  return session;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await assertAdminSession();
  if (!session) {
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
  const session = await assertAdminSession();
  if (!session) {
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

  await cache.set(cacheKey(result.data.slug), result.data, PREVIEW_TTL_SECONDS);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await assertAdminSession();
  if (!session) {
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
