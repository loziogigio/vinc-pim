import { NextRequest, NextResponse } from "next/server";
import { getPageConfig } from "@/lib/db/pages";

export async function GET(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  const slug = pathname.split("/").pop() || "home";
  const pageConfig = await getPageConfig(slug);

  if (!pageConfig) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json(pageConfig);
}
