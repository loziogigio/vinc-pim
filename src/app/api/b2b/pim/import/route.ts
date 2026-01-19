import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { uploadToCdn, isCdnConfigured } from "@/lib/services/cdn-upload.service";

/**
 * POST /api/b2b/pim/import
 * Upload file and queue import job
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ImportSource: ImportSourceModel, ImportJob: ImportJobModel } = await connectWithModels(tenantDb);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sourceId = formData.get("source_id") as string;

    if (!file || !sourceId) {
      return NextResponse.json(
        { error: "Missing file or source_id" },
        { status: 400 }
      );
    }

    // Verify source exists (temporarily using any wholesaler)
    const source = await ImportSourceModel.findOne({
      source_id: sourceId,
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 50MB)" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExt = file.name.toLowerCase().split(".").pop();
    if (!["csv", "xlsx", "xls"].includes(fileExt || "")) {
      return NextResponse.json(
        { error: "Invalid file type. Only CSV and Excel files are supported" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to CDN (required)
    const cdnConfigured = await isCdnConfigured();
    if (!cdnConfigured) {
      return NextResponse.json(
        { error: "CDN is not configured. File upload requires CDN to be set up." },
        { status: 500 }
      );
    }

    console.log(`📤 Uploading ${file.name} to CDN...`);
    let fileUrl: string;

    try {
      const uploadResult = await uploadToCdn({
        buffer,
        content_type: file.type || "application/octet-stream",
        file_name: `pim-imports/${file.name}`,
      });
      fileUrl = uploadResult.url;
      console.log(`✅ File uploaded to CDN: ${fileUrl}`);
    } catch (error: any) {
      console.error("❌ CDN upload failed:", error);
      return NextResponse.json(
        {
          error: "Failed to upload file to CDN",
          details: error.message
        },
        { status: 500 }
      );
    }

    // Create import job (using source's wholesaler_id)
    const jobId = `import_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const job = await ImportJobModel.create({
      // No wholesaler_id - database provides isolation
      source_id: sourceId,
      job_id: jobId,
      file_name: file.name,
      file_size: file.size,
      file_url: fileUrl,
      status: "pending",
    });

    // Queue for processing using BullMQ
    try {
      // Import the queue dynamically to avoid errors if Redis is not configured
      const { importQueue } = await import("@/lib/queue/queues");

      const queueData = {
        job_id: jobId,
        source_id: sourceId,
        // No wholesaler_id - database provides isolation
        file_url: fileUrl, // CDN URL only
        file_name: file.name,
      };

      console.log(`📮 Queueing job ${jobId} with CDN file: ${fileUrl}`);

      await importQueue.add("process-import", queueData);
      console.log(`✅ Job ${jobId} queued successfully`);
    } catch (error) {
      console.error("❌ Queue error:", error);
      // Job is already created in DB, worker can pick it up later
    }

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    console.error("Error queueing import:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/b2b/pim/import/[jobId]
 * Get import job status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ImportJob: ImportJobModel } = await connectWithModels(tenantDb);

    const url = new URL(req.url);
    const jobId = url.pathname.split("/").pop();

    const job = await ImportJobModel.findOne({
      job_id: jobId,
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
