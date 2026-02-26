import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { uploadToCdn } from "vinc-cdn";
import { getCdnConfig, isCdnConfigured } from "@/lib/services/cdn-config";

/**
 * POST /api/b2b/editor/upload-image
 * Upload an image to CDN for use in rich text editor
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cdnConfigured = await isCdnConfigured();
    if (!cdnConfigured) {
      return NextResponse.json(
        { error: "CDN is not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Image must be less than 5MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get CDN config
    const config = await getCdnConfig();
    if (!config) {
      return NextResponse.json({ error: "CDN configuration not found" }, { status: 500 });
    }

    // Upload to CDN
    const result = await uploadToCdn(config, {
      buffer,
      contentType: file.type,
      fileName: file.name,
    });

    return NextResponse.json({
      url: result.url,
      cdn_key: result.key,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
