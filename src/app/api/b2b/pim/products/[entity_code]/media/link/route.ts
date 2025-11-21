import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { nanoid } from "nanoid";

/**
 * POST /api/b2b/pim/products/[entity_code]/media/link
 * Add an external link (YouTube, Vimeo, CDN URL, etc.) to product media
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Check authentication
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;

    // Parse request body
    const body = await req.json();
    const { url, type, label } = body;

    // Validate required fields
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid url parameter" },
        { status: 400 }
      );
    }

    if (!type || !["document", "video", "3d-model"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid or missing type parameter" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the product
    const product = await PIMProductModel.findOne({
      entity_code,
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Calculate position for new media item
    const existingMediaOfType = (product.media || []).filter(
      (m: any) => m.type === type
    );
    const maxPosition =
      existingMediaOfType.length > 0
        ? Math.max(...existingMediaOfType.map((m: any) => m.position || 0))
        : -1;

    // Determine file type based on URL
    let file_type = "link";
    if (type === "video") {
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        file_type = "youtube";
      } else if (url.includes("vimeo.com")) {
        file_type = "vimeo";
      } else {
        file_type = "video/link";
      }
    } else if (type === "document") {
      const urlLower = url.toLowerCase();
      if (urlLower.endsWith(".pdf")) {
        file_type = "application/pdf";
      } else if (urlLower.endsWith(".doc") || urlLower.endsWith(".docx")) {
        file_type = "application/msword";
      } else if (urlLower.endsWith(".xls") || urlLower.endsWith(".xlsx")) {
        file_type = "application/vnd.ms-excel";
      } else {
        file_type = "document/link";
      }
    } else if (type === "3d-model") {
      const urlLower = url.toLowerCase();
      if (urlLower.endsWith(".glb")) {
        file_type = "model/gltf-binary";
      } else if (urlLower.endsWith(".gltf")) {
        file_type = "model/gltf+json";
      } else {
        file_type = "model/link";
      }
    }

    // Create new media entry
    const newMediaItem = {
      type: type,
      file_type: file_type,
      url: url,
      cdn_key: `link_${nanoid(12)}`, // Generate unique ID for the link
      label: label || url,
      uploaded_at: new Date(),
      uploaded_by: session.userId,
      is_external_link: true,
      position: maxPosition + 1,
    };

    // Update product with new media link
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        isCurrent: true,
      },
      {
        $push: { media: newMediaItem },
        $set: {
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: "External link added successfully",
      media: newMediaItem,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error adding media link:", error);
    return NextResponse.json(
      {
        error: "Failed to add media link",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
