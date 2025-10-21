import { NextRequest, NextResponse } from "next/server";
import { getPageConfig } from "@/lib/db/pages";
import { getTemplateConfig } from "@/lib/db/product-templates-simple";

export async function GET(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  const slug = pathname.split("/").pop() || "home";
  const url = new URL(request.url);
  const matchType = url.searchParams.get("matchType") as "sku" | "parentSku" | null;
  const value = url.searchParams.get("value");

  try {
    // Check if this is a product template request (new simplified format)
    if (matchType && value) {
      const templateConfig = await getTemplateConfig(matchType, value);
      return NextResponse.json(templateConfig);
    }

    // Special handling for "product-detail" - this is the default template
    // Return empty config that builder can start with
    if (slug === "product-detail") {
      const now = new Date().toISOString();
      return NextResponse.json({
        slug: "product-detail",
        name: "Product Detail Template",
        versions: [],
        currentVersion: 0,
        createdAt: now,
        updatedAt: now
      });
    }

    // Otherwise, handle as regular page
    const pageConfig = await getPageConfig(slug);

    if (!pageConfig) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(pageConfig);
  } catch (error) {
    console.error(`Error fetching config for slug "${slug}":`, error);
    return NextResponse.json(
      { error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}
