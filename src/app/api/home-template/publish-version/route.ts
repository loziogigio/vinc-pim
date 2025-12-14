import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import { publishHomeTemplateVersion, type PublishMetadataInput } from "@/lib/db/home-templates";

const extractMetadata = (body: any): PublishMetadataInput | undefined => {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const metadata: PublishMetadataInput = {};
  let hasField = false;

  if (body.campaign !== undefined) {
    metadata.campaign = body.campaign;
    hasField = true;
  }
  if (body.segment !== undefined) {
    metadata.segment = body.segment;
    hasField = true;
  }

  let attributesSource: Record<string, string | string[] | null | undefined> | undefined;
  if (body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes)) {
    attributesSource = body.attributes as Record<string, string | string[] | null | undefined>;
  } else {
    const fallback: Record<string, string | string[] | null | undefined> = {};
    ["region", "language", "device", "addressStates"].forEach((key) => {
      if (body[key] !== undefined) {
        fallback[key] = body[key];
      }
    });
    if (Object.keys(fallback).length > 0) {
      attributesSource = fallback;
    }
  }

  if (attributesSource) {
    metadata.attributes = attributesSource;
    hasField = true;
  }

  if (body.priority !== undefined) {
    metadata.priority = body.priority;
    hasField = true;
  }
  if (body.isDefault !== undefined) {
    metadata.isDefault = body.isDefault;
    hasField = true;
  }
  if (body.activeFrom !== undefined) {
    metadata.activeFrom = body.activeFrom;
    hasField = true;
  }
  if (body.activeTo !== undefined) {
    metadata.activeTo = body.activeTo;
    hasField = true;
  }
  if (body.comment !== undefined) {
    metadata.comment = body.comment;
    hasField = true;
  }

  return hasField ? metadata : undefined;
};

/**
 * POST /api/home-template/publish-version
 * Publish an existing version from history
 */
export async function POST(request: Request) {
  try {
    if (!(await hasHomeBuilderAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { version, ...rest } = body ?? {};

    if (typeof version !== "number") {
      return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
    }

    const metadata = extractMetadata(rest);

    const updated = await publishHomeTemplateVersion(version, metadata);
    revalidatePath("/");
    revalidatePath("/preview");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Publish home template version error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to publish version";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
