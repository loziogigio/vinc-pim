/**
 * Seed B2B User Script
 * Creates a test B2B user account for development
 *
 * Usage: npx tsx scripts/seed-b2b-user.ts
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { B2BUserModel } from "../src/lib/db/models/b2b-user.js";
import { B2BProductModel } from "../src/lib/db/models/b2b-product.js";
import { ActivityLogModel } from "../src/lib/db/models/activity-log.js";

// Use VINC_MONGO_URL from .env or fallback
const MONGO_URI = process.env.VINC_MONGO_URL || process.env.VINC_MONGO_URI || "mongodb://localhost:27017/vinc-storefront";
const DB_NAME = process.env.VINC_MONGO_DB || "vinc_storefront";

async function seedB2BUser() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`Connected to MongoDB: ${DB_NAME}`);

    // Create test B2B user
    const username = "b2b_admin";
    const password = "admin123";
    const passwordHash = await bcrypt.hash(password, 10);

    const existingUser = await B2BUserModel.findOne({ username });

    if (existingUser) {
      console.log(`User '${username}' already exists`);
    } else {
      await B2BUserModel.create({
        username,
        email: "b2b@example.com",
        passwordHash,
        role: "admin",
        companyName: "Test Company",
        isActive: true,
      });
      console.log(`✓ Created B2B user: ${username} / ${password}`);
    }

    // Create some sample products
    const existingProducts = await B2BProductModel.countDocuments();

    if (existingProducts === 0) {
      console.log("Creating sample products...");

      const sampleProducts = [
        {
          sku: "PUMP-001",
          title: "Grundfos MAGNA3 Circulator Pump",
          category: "Pumps",
          status: "enhanced" as const,
          description: "High-efficiency circulator pump for heating systems",
          marketingContent: "Industry-leading efficiency and reliability",
          images: ["https://placehold.co/400x300/png?text=Pump"],
          price: 599.99,
          stock: 45,
        },
        {
          sku: "VALVE-202",
          title: "Honeywell Zone Valve V8043E",
          category: "Valves",
          status: "not_enhanced" as const,
          description: "Zone valve for hydronic heating systems",
          images: [],
          price: 89.99,
          stock: 120,
        },
        {
          sku: "TANK-303",
          title: "Zilmet Solar Expansion Tank",
          category: "Tanks",
          status: "needs_attention" as const,
          description: "Expansion tank for solar thermal systems",
          images: ["https://placehold.co/400x300/png?text=Tank"],
          price: 249.99,
          stock: 30,
        },
        {
          sku: "CTRL-404",
          title: "Tekmar Control System",
          category: "Controls",
          status: "missing_data" as const,
          images: [],
          stock: 15,
        },
        {
          sku: "PIPE-505",
          title: "PEX-AL-PEX Multilayer Pipe 20mm",
          category: "Piping",
          status: "enhanced" as const,
          description: "Multilayer pipe for heating and plumbing",
          marketingContent: "Flexible, durable, and easy to install",
          images: ["https://placehold.co/400x300/png?text=Pipe"],
          price: 2.99,
          stock: 5000,
        },
      ];

      await B2BProductModel.insertMany(sampleProducts);
      console.log(`✓ Created ${sampleProducts.length} sample products`);
    } else {
      console.log(`${existingProducts} products already exist`);
    }

    // Create sample activity log
    const existingLogs = await ActivityLogModel.countDocuments();

    if (existingLogs === 0) {
      console.log("Creating sample activity logs...");

      const sampleLogs = [
        {
          type: "erp_sync" as const,
          description: "ERP Sync completed",
          details: { count: 128 },
          performedBy: "system",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          type: "bulk_enhancement" as const,
          description: "Bulk AI Enhancement",
          details: { count: 50 },
          performedBy: username,
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        },
        {
          type: "image_upload" as const,
          description: "Supplier sync",
          details: { count: 3400 },
          performedBy: "system",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        },
      ];

      await ActivityLogModel.insertMany(sampleLogs);
      console.log(`✓ Created ${sampleLogs.length} sample activity logs`);
    } else {
      console.log(`${existingLogs} activity logs already exist`);
    }

    console.log("\n=== Seed completed successfully! ===");
    console.log("\nLogin credentials:");
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log(`\nAccess the B2B portal at: http://localhost:3000/b2b/login`);

  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

seedB2BUser();
