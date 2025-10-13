import { NextResponse } from "next/server";
import { savePageConfig } from "@/lib/db/pages";
import { pageConfigSchema } from "@/lib/validation/blockSchemas";

export async function POST(request: Request) {
  const payload = await request.json();
  const result = pageConfigSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json({ error: "Invalid page payload", details: result.error.flatten() }, { status: 400 });
  }

  const saved = await savePageConfig(result.data);
  return NextResponse.json(saved, { status: 200 });
}
