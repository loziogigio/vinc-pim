import { NextResponse } from "next/server";

const CUSTOMER_WEB_BASE = (process.env.NEXT_PUBLIC_CUSTOMER_WEB_URL || "http://localhost:3000").replace(/\/$/, "");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get("text") || "").trim();
  const query = (searchParams.get("query") || "").trim();
  const limit = searchParams.get("limit") || "8";

  if (!text && !query) {
    return NextResponse.json({ items: [] });
  }

  try {
    const targetUrl = new URL(`${CUSTOMER_WEB_BASE}/api/b2b/product-search`);
    targetUrl.searchParams.set("limit", limit);
    if (query) {
      targetUrl.searchParams.set("query", query);
    } else if (text) {
      targetUrl.searchParams.set("text", text);
    }

    const response = await fetch(targetUrl.toString(), {
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      console.error('[customer-web/product-search] upstream error', response.status);
      return NextResponse.json({ items: [], error: "Unable to load preview results." }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[customer-web/product-search] proxy failure', error);
    return NextResponse.json({ items: [], error: "Unable to load preview results." }, { status: 500 });
  }
}
