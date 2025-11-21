/**
 * Upload test CSV via import API
 */

import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import fetch from "node-fetch";

async function uploadTestCSV() {
  try {
    console.log("📤 Uploading test CSV via import API...\n");

    const csvPath = path.join(__dirname, "../test-products.csv");

    if (!fs.existsSync(csvPath)) {
      console.error("❌ CSV file not found:", csvPath);
      process.exit(1);
    }

    // Read CSV file
    const fileBuffer = fs.readFileSync(csvPath);
    console.log(`✅ Read CSV file: ${csvPath} (${fileBuffer.length} bytes)`);

    // Create form data
    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: "test-products.csv",
      contentType: "text/csv",
    });
    formData.append("source_id", "test-default-lang");

    // Upload to API
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const uploadUrl = `${API_URL}/api/b2b/pim/import`;

    console.log(`📡 Uploading to: ${uploadUrl}`);
    console.log(`   Source ID: test-default-lang`);
    console.log(`   File: test-products.csv\n`);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();

    console.log("✅ Upload successful!");
    console.log("\n📦 Job Details:");
    console.log(JSON.stringify(result.job, null, 2));

    console.log("\n📝 Next steps:");
    console.log("   1. Monitor the import worker logs to see default language being applied");
    console.log("   2. Check the job status:");
    console.log(`      GET ${API_URL}/api/b2b/pim/import?jobId=${result.job.job_id}`);
    console.log("   3. Verify products in database:");
    console.log("      npm run check-products");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

uploadTestCSV();
