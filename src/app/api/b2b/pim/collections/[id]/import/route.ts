import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { CollectionModel } from "@/lib/db/models/collection";
import { AssociationJobModel } from "@/lib/db/models/association-job";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";
import { nanoid } from "nanoid";

// POST /api/b2b/pim/collections/[id]/import - Import products from file
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Await params (Next.js 15+)
    const { id } = await params;

    // Get action from query params
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "action query parameter must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    // Verify collection exists (no wholesaler_id - database provides isolation)
    const collection = await CollectionModel.findOne({
      collection_id: id,
    }).lean() as any;

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Parse file from form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".txt") && !fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Invalid file type. Must be .txt, .csv, or .xlsx" },
        { status: 400 }
      );
    }

    // Read file contents
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);

    // Parse entity codes based on file type
    let entityCodes: string[] = [];

    if (fileName.endsWith(".txt")) {
      // Simple text file - one entity_code per line
      entityCodes = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } else if (fileName.endsWith(".csv")) {
      // CSV file - parse and extract entity_code column
      const lines = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);

      if (lines.length === 0) {
        return NextResponse.json({ error: "Empty file" }, { status: 400 });
      }

      // Check if first line is header
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("entity_code") || firstLine.includes("sku");

      const dataLines = hasHeader ? lines.slice(1) : lines;

      // Parse CSV (simple parsing, doesn't handle complex quoted values)
      entityCodes = dataLines.map(line => {
        const parts = line.split(",");
        return parts[0].replace(/^["']|["']$/g, "").trim();
      }).filter(code => code.length > 0);
    } else if (fileName.endsWith(".xlsx")) {
      // XLSX - for now, treat as CSV
      // TODO: Use proper XLSX parser like xlsx or exceljs
      const lines = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);

      if (lines.length === 0) {
        return NextResponse.json({ error: "Empty file" }, { status: 400 });
      }

      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("entity_code") || firstLine.includes("sku");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      entityCodes = dataLines.map(line => {
        const parts = line.split(",");
        return parts[0].replace(/^["']|["']$/g, "").trim();
      }).filter(code => code.length > 0);
    }

    if (entityCodes.length === 0) {
      return NextResponse.json(
        { error: "No valid entity codes found in file" },
        { status: 400 }
      );
    }

    // Create association job
    const jobId = nanoid(16);
    const job = await AssociationJobModel.create({
      job_id: jobId,
      job_type: "collection_import",
      entity_type: "collection",
      entity_id: id,
      entity_name: collection.name,
      action,
      status: "pending",
      total_items: entityCodes.length,
      processed_items: 0,
      successful_items: 0,
      failed_items: 0,
      metadata: {
        file_name: file.name,
        entity_codes: entityCodes,
      },
    });

    // Process asynchronously
    processCollectionImportJob(jobId, id, entityCodes, action, session.userId, collection).catch(
      (error) => {
        console.error("Background job error:", error);
      }
    );

    return NextResponse.json({
      message: "Import job started",
      job_id: jobId,
      total_items: entityCodes.length,
    });
  } catch (error: any) {
    console.error("Error importing collection products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import products" },
      { status: 500 }
    );
  }
}

// Background job processor
async function processCollectionImportJob(
  jobId: string,
  id: string,
  entityCodes: string[],
  action: string,
  wholesalerId: string,
  collection: any
) {
  try {
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

    // Process in batches of 100
    const batchSize = 100;
    let processedItems = 0;
    let successfulItems = 0;
    let failedItems = 0;
    const errors: string[] = [];

    for (let i = 0; i < entityCodes.length; i += batchSize) {
      const batch = entityCodes.slice(i, i + batchSize);

      try {
        if (action === "add") {
          // Add collection to products' collections array
          // Store name and slug as multilingual objects using collection's locale
          const locale = collection.locale || "it";
          const collectionData = {
            collection_id: id,
            name: { [locale]: collection.name },
            slug: { [locale]: collection.slug },
          };

          const result = await PIMProductModel.updateMany(
            {
              entity_code: { $in: batch },
              // No wholesaler_id - database provides isolation
              isCurrent: true,
              "collections.collection_id": { $ne: id }, // Only if not already in array
            },
            { $push: { collections: collectionData } }
          );

          successfulItems += result.modifiedCount;
          failedItems += batch.length - result.modifiedCount;
        } else {
          // Remove collection from products' collections array
          const result = await PIMProductModel.updateMany(
            {
              entity_code: { $in: batch },
              // No wholesaler_id - database provides isolation
              isCurrent: true,
              "collections.collection_id": id,
            },
            { $pull: { collections: { collection_id: id } } }
          );

          successfulItems += result.modifiedCount;
          failedItems += batch.length - result.modifiedCount;
        }

        processedItems += batch.length;

        // Update job progress
        await AssociationJobModel.updateOne(
          { job_id: jobId },
          {
            $set: {
              processed_items: processedItems,
              successful_items: successfulItems,
              failed_items: failedItems,
            },
          }
        );
      } catch (batchError: any) {
        console.error("Batch processing error:", batchError);
        errors.push(`Batch ${i / batchSize + 1}: ${batchError.message}`);
        failedItems += batch.length;
        processedItems += batch.length;

        await AssociationJobModel.updateOne(
          { job_id: jobId },
          {
            $set: {
              processed_items: processedItems,
              failed_items: failedItems,
            },
          }
        );
      }
    }

    // Update collection product count (no wholesaler_id - database provides isolation)
    const productCount = await PIMProductModel.countDocuments({
      isCurrent: true,
      "collections.collection_id": id,
    });

    await CollectionModel.updateOne(
      { collection_id: id },
      { $set: { product_count: productCount } }
    );

    // Sync affected products to Solr
    let solrSynced = 0;
    const adapterConfigs = loadAdapterConfigs();
    if (adapterConfigs.solr?.enabled && successfulItems > 0) {
      console.log(`🔄 Starting Solr sync for ${entityCodes.length} products after collection import`);

      const products = await PIMProductModel.find({
        entity_code: { $in: entityCodes },
        isCurrent: true,
      }).lean();

      const solrAdapter = new SolrAdapter(adapterConfigs.solr);

      for (const product of products) {
        try {
          const result = await solrAdapter.syncProduct(product as any);
          if (result.success) {
            solrSynced++;
          }
        } catch (error: any) {
          console.error(`Solr sync error for ${product.entity_code}:`, error.message);
        }
      }

      console.log(`✅ Synced ${solrSynced}/${products.length} products to Solr after ${action === "add" ? "adding to" : "removing from"} collection "${collection.name}"`);
    }

    // Mark job as completed
    await AssociationJobModel.updateOne(
      { job_id: jobId },
      {
        $set: {
          status: errors.length > 0 ? "failed" : "completed",
          completed_at: new Date(),
          error_message: errors.length > 0 ? errors.join("; ") : undefined,
          "metadata.solr_synced": solrSynced,
        },
      }
    );
  } catch (error: any) {
    console.error("Job processing error:", error);
    await AssociationJobModel.updateOne(
      { job_id: jobId },
      {
        $set: {
          status: "failed",
          completed_at: new Date(),
          error_message: error.message,
        },
      }
    );
  }
}
