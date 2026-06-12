import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { invalidateB2CCache } from "@/lib/cache/redis-client";
import { MenuLocation } from "@/lib/db/models/menu";
import {
  loadMenuLanguageContext,
  resolveMenuLanguage,
  isDefaultMenuLanguage,
  menuLanguageFilter,
} from "@/lib/utils/menu-language";
import { nanoid } from "nanoid";

/**
 * POST /api/b2b/menu/clone-language
 * Seed a language's menu by cloning the default-language version for a given
 * (channel, location). Hierarchy is preserved (parent_id / path remapped to the
 * newly created ids). Refuses to run if the target language already has items.
 *
 * Body: { channel, location, targetLanguage }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { MenuItem: MenuItemModel, Language: LanguageModel } =
      await connectWithModels(tenantDb);

    const body = await req.json();
    const channel: string = body.channel || "default";
    const location = body.location as MenuLocation | undefined;
    const langCtx = await loadMenuLanguageContext(LanguageModel);
    const targetLanguage = resolveMenuLanguage(body.targetLanguage, langCtx);

    if (!location) {
      return NextResponse.json(
        { error: "location is required" },
        { status: 400 }
      );
    }
    if (isDefaultMenuLanguage(targetLanguage, langCtx)) {
      return NextResponse.json(
        { error: "Cannot clone into the default language" },
        { status: 400 }
      );
    }

    // Guard: don't overwrite an existing version.
    const existing = await MenuItemModel.countDocuments({
      channel,
      location,
      ...menuLanguageFilter(targetLanguage, langCtx),
    });
    if (existing > 0) {
      return NextResponse.json(
        { error: "Target language already has a menu" },
        { status: 409 }
      );
    }

    // Source = default-language version, ordered parents-before-children.
    const source = await MenuItemModel.find({
      channel,
      location,
      ...menuLanguageFilter(langCtx.defaultCode, langCtx),
    })
      .sort({ level: 1, position: 1 })
      .lean();

    if (source.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    // Map old ids → new ids so parent_id / path can be remapped.
    const idMap: Record<string, string> = {};
    for (const item of source) {
      idMap[item.menu_item_id] = nanoid(12);
    }

    const clones = source.map((item: any) => {
      const { _id, __v, created_at, updated_at, ...rest } = item;
      return {
        ...rest,
        menu_item_id: idMap[item.menu_item_id],
        language: targetLanguage,
        parent_id: item.parent_id ? idMap[item.parent_id] : item.parent_id,
        path: Array.isArray(item.path)
          ? item.path.map((p: string) => idMap[p] ?? p)
          : [],
      };
    });

    await MenuItemModel.insertMany(clones);

    invalidateB2CCache(tenantDb, "menu").catch(() => {});

    return NextResponse.json({ created: clones.length }, { status: 201 });
  } catch (error) {
    console.error("Error cloning menu language:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
