import { NextResponse } from "next/server";
import { getPageConfig } from "@/lib/db/pages";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug ?? "home";
  const pageConfig = await getPageConfig(slug);

  if (!pageConfig) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json(pageConfig);
}
