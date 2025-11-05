import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { uploadImage } from "@/lib/cdn/image-upload";

// POST /api/b2b/pim/brands/upload-logo - Upload brand logo to CDN
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Upload to CDN in brands folder
    const result = await uploadImage(file, `brands`);

    return NextResponse.json({
      url: result.url,
      cdn_key: result.cdn_key,
      file_name: result.file_name,
      message: "Logo uploaded successfully",
    });
  } catch (error: any) {
    console.error("Error uploading brand logo:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload logo" },
      { status: 500 }
    );
  }
}
