import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getB2BSession } from "@/lib/auth/b2b-session";

/**
 * Validate that a URL is a safe external HTTPS endpoint (not internal/private).
 */
function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname;
    // Block private/internal IPs and hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/b2b/home-settings/test-cdn
 * Test CDN credentials by uploading and deleting a test file
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { cdn_url, bucket_region, bucket_name, folder_name, cdn_key, cdn_secret } = body;

    // Validate required fields
    if (!cdn_url || !bucket_region || !bucket_name || !cdn_key || !cdn_secret) {
      return NextResponse.json(
        { error: "Missing required fields: cdn_url, bucket_region, bucket_name, cdn_key, cdn_secret" },
        { status: 400 }
      );
    }

    // Validate CDN URL is safe (HTTPS, no internal IPs)
    if (!isSafeUrl(cdn_url)) {
      return NextResponse.json(
        { error: "CDN URL must be a valid HTTPS URL pointing to an external host" },
        { status: 400 }
      );
    }

    // Create S3 client with provided credentials
    const s3Client = new S3Client({
      endpoint: cdn_url,
      region: bucket_region,
      credentials: {
        accessKeyId: cdn_key,
        secretAccessKey: cdn_secret,
      },
      forcePathStyle: true,
    });

    // Generate test file key
    const testKey = folder_name
      ? `${folder_name}/cdn-test-${Date.now()}.txt`
      : `cdn-test-${Date.now()}.txt`;

    const testContent = `CDN Connection Test - ${new Date().toISOString()}`;

    // Step 1: Upload test file
    console.log(`[CDN Test] Uploading test file: ${testKey}`);
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket_name,
        Key: testKey,
        Body: testContent,
        ContentType: "text/plain",
      }));
      console.log(`[CDN Test] Upload successful`);
    } catch (uploadError: any) {
      console.error(`[CDN Test] Upload failed:`, uploadError);
      return NextResponse.json(
        {
          error: "Upload test failed",
          details: uploadError.message || "Could not upload test file to CDN",
          step: "upload"
        },
        { status: 400 }
      );
    }

    // Step 2: Delete test file
    console.log(`[CDN Test] Deleting test file: ${testKey}`);
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket_name,
        Key: testKey,
      }));
      console.log(`[CDN Test] Delete successful`);
    } catch (deleteError: any) {
      console.error(`[CDN Test] Delete failed:`, deleteError);
      // Upload worked but delete failed - credentials are partially valid
      return NextResponse.json(
        {
          error: "Delete test failed (upload succeeded)",
          details: deleteError.message || "Could not delete test file from CDN",
          step: "delete",
          warning: "Credentials work for upload but may not have delete permissions"
        },
        { status: 400 }
      );
    }

    // Both tests passed
    return NextResponse.json({
      success: true,
      message: "CDN credentials are valid. Upload and delete tests passed.",
    });

  } catch (error: any) {
    console.error("[CDN Test] Error:", error);
    return NextResponse.json(
      { error: "Test failed", details: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}