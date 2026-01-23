import { NextResponse } from "next/server";
import { connectWithModels, autoDetectTenantDb } from "@/lib/db/connection";

async function getCustomerWebBase(): Promise<string | null> {
  try {
    const dbName = await autoDetectTenantDb();
    const { HomeSettings } = await connectWithModels(dbName);
    const settings = await HomeSettings.findOne({}).lean();
    const shopUrl = settings?.branding?.shopUrl;
    if (shopUrl) {
      return shopUrl.replace(/\/$/, "");
    }
  } catch (err) {
    console.warn("[customer-web/product-search] Failed to fetch shopUrl from settings:", err);
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get("text") || "").trim();
  const query = (searchParams.get("query") || "").trim();
  const limit = searchParams.get("limit") || "8";

  if (!text && !query) {
    return NextResponse.json({ items: [] });
  }

  try {
    const customerWebBase = await getCustomerWebBase();

    if (!customerWebBase) {
      return NextResponse.json({ items: [], error: "Shop URL not configured. Set it in Home Settings." }, { status: 500 });
    }

    const targetUrl = new URL(`${customerWebBase}/api/b2b/product-search`);
    targetUrl.searchParams.set("limit", limit);
    if (query) {
      targetUrl.searchParams.set("query", query);
    } else if (text) {
      targetUrl.searchParams.set("text", text);
    }

    console.log('[customer-web/product-search] Fetching from:', targetUrl.toString());

    const response = await fetch(targetUrl.toString(), {
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error('[customer-web/product-search] upstream error', response.status, errorText.slice(0, 500));
      return NextResponse.json({ items: [], error: `Upstream error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[customer-web/product-search] proxy failure', error);
    return NextResponse.json({ items: [], error: "Unable to load preview results." }, { status: 500 });
  }
}
