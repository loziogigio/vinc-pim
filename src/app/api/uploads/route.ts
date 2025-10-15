import { Buffer } from "node:buffer";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { isCdnConfigured, uploadToCdn } from "@/lib/services/cdnClient";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCdnConfigured()) {
    return NextResponse.json(
      { error: "CDN is not configured. Set CDN environment variables first." },
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToCdn({
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
