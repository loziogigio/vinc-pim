import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { uploadMultipleImages, uploadMultipleMedia } from "vinc-cdn";
import { getCdnConfig } from "@/lib/services/cdn-config";

/**
 * POST /api/b2b/pim/products/[entity_code]/blocks/media
 * Uploads a single Dynamic Block asset to S3/CDN under products/{entity_code}/blocks/
 * and returns { url, cdn_key, is_external_link }. DELIBERATELY does NOT mutate
 * product.images/product.media — block assets stay out of the gallery (no product fetch).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Standard tenant auth integration (session / api-key / bearer) — the same
    // gate every other B2B route uses. CDN-only route (no tenant DB write), so we
    // only need a valid auth context, not tenantId specifically.
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;
    const { entity_code } = await params;
    const formData = await req.formData();
    const files = formData.getAll("media") as File[];
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No media file provided" }, { status: 400 });
    }
    const config = await getCdnConfig();
    if (!config) {
      return NextResponse.json({ error: "CDN not configured" }, { status: 500 });
    }
    // Pick the right uploader by file type: images go through the image pipeline
    // (uploadMultipleMedia's MEDIA_TYPE_CONFIG only covers document/video/3d-model
    // and rejects images); videos/3D/documents go through the media pipeline.
    const folder = `products/${entity_code}/blocks`;
    const isImage = (files[0]?.type ?? "").startsWith("image/");
    const uploadResults = isImage
      ? await uploadMultipleImages(config, files, folder)
      : await uploadMultipleMedia(config, files, folder);
    const first = uploadResults.successful[0];
    if (!first) {
      console.error("[blocks/media] upload failed:", JSON.stringify(uploadResults.failed));
      return NextResponse.json({ error: "Media upload failed", failures: uploadResults.failed }, { status: 400 });
    }
    return NextResponse.json({ url: first.url, cdn_key: first.key, is_external_link: false });
  } catch (error) {
    console.error("Error uploading block media:", error);
    return NextResponse.json(
      { error: "Failed to upload block media", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
