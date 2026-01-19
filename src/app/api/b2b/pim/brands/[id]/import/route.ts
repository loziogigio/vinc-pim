import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";

// POST /api/b2b/pim/brands/[id]/import - Import product associations
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Brand: BrandModel, AssociationJob: AssociationJobModel } = await connectWithModels(tenantDb);

    // Await params (Next.js 15+)
    const { id } = await params;

    // Get action from query params
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    // Verify brand exists (no wholesaler_id - database provides isolation)
    const brand = await BrandModel.findOne({
      brand_id: id,
    }).lean() as any;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".txt")) {
      return NextResponse.json(
        { error: "Invalid file type. Must be CSV, XLSX, or TXT" },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();

    // Parse entity codes from file
    let entityCodes: string[] = [];

    if (fileName.endsWith(".txt")) {
      // TXT format: one entity_code per line
      entityCodes = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } else if (fileName.endsWith(".csv")) {
      // CSV format: first column is entity_code, skip header if present
      const lines = text.split("\n").filter(line => line.trim().length > 0);
      entityCodes = lines
        .map(line => {
          const parts = line.split(",");
          return parts[0]?.trim().replace(/^["']|["']$/g, "");
        })
        .filter((code, index) => {
          // Skip header row if it contains "entity_code"
          if (index === 0 && code.toLowerCase() === "entity_code") {
            return false;
          }
          return code && code.length > 0;
        });
    } else if (fileName.endsWith(".xlsx")) {
      // For XLSX, we'll treat it as CSV for now
      // TODO: Use a library like xlsx to properly parse XLSX files
      const lines = text.split("\n").filter(line => line.trim().length > 0);
      entityCodes = lines
        .map(line => {
          const parts = line.split(",");
          return parts[0]?.trim().replace(/^["']|["']$/g, "");
        })
        .filter((code, index) => {
          if (index === 0 && code.toLowerCase() === "entity_code") {
            return false;
          }
          return code && code.length > 0;
        });
    }

    if (entityCodes.length === 0) {
      return NextResponse.json(
        { error: "No valid entity codes found in file" },
        { status: 400 }
      );
    }

    // Create a job record
    const jobId = nanoid(16);
    const job = {
      job_id: jobId,
      job_type: "brand_import" as const,
      entity_type: "brand" as const,
      entity_id: id,
      entity_name: brand.label,
      action: action as "add" | "remove",
      status: "pending" as const,
      total_items: entityCodes.length,
      processed_items: 0,
      successful_items: 0,
      failed_items: 0,
      metadata: {
        file_name: file.name,
        entity_codes: entityCodes,
      },
      created_at: new Date(),
    };

    // Store job in database
    const jobDoc = await AssociationJobModel.create(job);

    // Process the job asynchronously (in background)
    // For now, we'll process immediately but in production this should use a queue
    processAssociationJob(jobId, id, entityCodes, action, tenantDb, brand).catch(err => {
      console.error("Error processing association job:", err);
    });

    return NextResponse.json({
      message: "Import job started successfully",
      job_id: jobId,
      total_items: entityCodes.length,
    });
  } catch (error: any) {
    console.error("Error importing brand products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import products" },
      { status: 500 }
    );
  }
}

// Background job processor
async function processAssociationJob(
  jobId: string,
  brandId: string,
  entityCodes: string[],
  action: string,
  tenantDb: string,
  brand: any
) {
  try {
    const { Brand: BrandModel, PIMProduct: PIMProductModel, AssociationJob: AssociationJobModel } = await connectWithModels(tenantDb);

    // Update job status to processing
    await AssociationJobModel.updateOne(
      { job_id: jobId },
      {
        $set: {
          status: "processing",
          started_at: new Date(),
        },
      }
    );

    let successful = 0;
    let failed = 0;
    const errors: { item: string; error: string }[] = [];

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < entityCodes.length; i += batchSize) {
      const batch = entityCodes.slice(i, i + batchSize);

      try {
        if (action === "add") {
          // Associate products with brand (using BrandBase field names)
          const updateData: any = {
            "brand.brand_id": brandId,
            "brand.label": brand.label,
            "brand.slug": brand.slug,
            "brand.is_active": brand.is_active ?? true,
          };

          if (brand.logo_url) {
            updateData["brand.logo_url"] = brand.logo_url;
          }
          if (brand.description) {
            updateData["brand.description"] = brand.description;
          }

          const result = await PIMProductModel.updateMany(
            {
              entity_code: { $in: batch },
              // No wholesaler_id - database provides isolation
              isCurrent: true,
            },
            { $set: updateData }
          );

          successful += result.modifiedCount;
        } else {
          // Remove brand from products
          const result = await PIMProductModel.updateMany(
            {
              entity_code: { $in: batch },
              // No wholesaler_id - database provides isolation
              isCurrent: true,
              "brand.brand_id": brandId,
            },
            { $unset: { brand: "" } }
          );

          successful += result.modifiedCount;
        }
      } catch (error: any) {
        failed += batch.length;
        errors.push({
          item: batch.join(", "),
          error: error.message,
        });
      }

      // Update progress
      await AssociationJobModel.updateOne(
        { job_id: jobId },
        {
          $set: {
            processed_items: Math.min(i + batchSize, entityCodes.length),
            successful_items: successful,
            failed_items: failed,
          },
        }
      );
    }

    // Update brand product count
    const productCount = await PIMProductModel.countDocuments({
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "brand.brand_id": brandId,
    });

    await BrandModel.updateOne(
      { brand_id: brandId },
      { $set: { product_count: productCount } }
    );

    // Mark job as completed
    await AssociationJobModel.updateOne(
      { job_id: jobId },
      {
        $set: {
          status: "completed",
          completed_at: new Date(),
          successful_items: successful,
          failed_items: failed,
          errors,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in processAssociationJob:", error);

    try {
      const { AssociationJob: AssociationJobModel } = await connectWithModels(tenantDb);
      await AssociationJobModel.updateOne(
        { job_id: jobId },
        {
          $set: {
            status: "failed",
            completed_at: new Date(),
            errors: [{ item: "system", error: error.message }],
          },
        }
      );
    } catch (updateError) {
      console.error("Failed to update job status:", updateError);
    }
  }
}
