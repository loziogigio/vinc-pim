import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { B2BProductModel } from "@/lib/db/models/b2b-product";
import { ActivityLogModel } from "@/lib/db/models/activity-log";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the uploaded file
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload .xlsx, .xls, or .csv files." },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel/CSV file
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: "File is empty or has no valid data" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Process products with validation
    const results = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ row: number; error: string; data: any }>,
    };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 2; // +2 because Excel rows start at 1 and we have a header

      try {
        // Map columns (flexible mapping - supports various column names)
        const sku = row.SKU || row.sku || row.Code || row.code;
        const title = row.Title || row.title || row.Name || row.name || row["Product Name"];
        const description = row.Description || row.description || row.desc;
        const category = row.Category || row.category || row.Type || row.type;
        const price = parseFloat(row.Price || row.price || row.Cost || row.cost || "0");
        const stock = parseInt(row.Stock || row.stock || row.Inventory || row.inventory || "0");
        const brand = row.Brand || row.brand || row.Manufacturer || row.manufacturer;
        const supplier = row.Supplier || row.supplier || row.Vendor || row.vendor;
        const status = row.Status || row.status || "not_enhanced";

        // Validate required fields
        if (!sku) {
          results.errors.push({
            row: rowNumber,
            error: "Missing required field: SKU",
            data: row,
          });
          continue;
        }

        if (!title) {
          results.errors.push({
            row: rowNumber,
            error: "Missing required field: Title/Name",
            data: row,
          });
          continue;
        }

        // Parse images (comma-separated URLs)
        let images: string[] = [];
        if (row.Images || row.images || row.Image || row.image) {
          const imageStr = row.Images || row.images || row.Image || row.image;
          images = imageStr.split(",").map((url: string) => url.trim()).filter(Boolean);
        }

        // Check if product exists
        const existingProduct = await B2BProductModel.findOne({ sku });

        const productData = {
          sku,
          title,
          description: description || "",
          category: category || "Uncategorized",
          price,
          stock,
          images,
          brand: brand || "",
          supplier: supplier || "",
          status: ["enhanced", "not_enhanced", "needs_attention", "missing_data"].includes(status)
            ? status
            : "not_enhanced",
          lastSyncedAt: new Date(),
        };

        if (existingProduct) {
          // Update existing product
          await B2BProductModel.findByIdAndUpdate(existingProduct._id, {
            ...productData,
            updatedAt: new Date(),
          });
          results.updated++;
        } else {
          // Create new product
          await B2BProductModel.create(productData);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          row: rowNumber,
          error: error.message || "Unknown error",
          data: row,
        });
      }
    }

    // Log activity
    if (results.created > 0 || results.updated > 0) {
      await ActivityLogModel.create({
        userId: session.userId,
        action: "bulk_import",
        description: `Imported ${results.created + results.updated} products from Excel`,
        details: {
          count: results.created + results.updated,
          created: results.created,
          updated: results.updated,
          errors: results.errors.length,
          fileName: file.name,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${rawData.length} rows`,
      results: {
        total: rawData.length,
        created: results.created,
        updated: results.updated,
        errors: results.errors.length,
        errorDetails: results.errors.slice(0, 10), // Return first 10 errors
      },
    });
  } catch (error) {
    console.error("Excel upload error:", error);
    return NextResponse.json(
      { error: "Failed to process Excel file" },
      { status: 500 }
    );
  }
}
