import { Buffer } from "node:buffer";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { uploadToCdn } from "vinc-cdn";
import { getCdnConfig, isCdnConfigured } from "@/lib/services/cdn-config";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  // Check for admin session OR B2B session (both are valid)
  const adminSession = await requireAdminSession();
  const b2bSession = await getB2BSession();

  const isAuthenticated = adminSession?.isLoggedIn || b2bSession?.isLoggedIn;

  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cdnConfigured = await isCdnConfigured();
  if (!cdnConfigured) {
    return NextResponse.json(
      { error: "CDN is not configured. Configure CDN credentials in settings or environment variables." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` },
      { status: 400 }
    );
  }

  try {
    const config = await getCdnConfig();
    if (!config) {
      return NextResponse.json({ error: "CDN configuration not found" }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToCdn(config, {
      buffer,
      contentType: file.type || "application/octet-stream",
      fileName: file.name
    });

    return NextResponse.json(
      {
        url: result.url,
        key: result.key,
        size: file.size,
        contentType: file.type
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to upload file to CDN", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
