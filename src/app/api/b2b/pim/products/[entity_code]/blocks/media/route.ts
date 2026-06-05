import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { uploadMultipleMedia } from "vinc-cdn";
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
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    const uploadResults = await uploadMultipleMedia(config, files, `products/${entity_code}/blocks`);
    const first = uploadResults.successful[0];
    if (!first) {
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
