/**
 * List B2B Users Script
 *
 * Shows all B2B users with their IDs (useful for seeding orders)
 * Run with: npx tsx scripts/list-b2b-users.ts
 */

import mongoose from "mongoose";
import { config } from "dotenv";

config({ path: ".env" });

const B2BUserSchema = new mongoose.Schema({
  username: String,
  email: String,
  role: String,
  companyName: String,
  isActive: Boolean,
}, { timestamps: true });

const B2BUserModel = mongoose.models.B2BUser || mongoose.model("B2BUser", B2BUserSchema, "b2busers");

async function listUsers() {
  const mongoUrl = process.env.VINC_MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error("VINC_MONGO_URL or MONGODB_URI not set");
    process.exit(1);
  }

  const tenantId = process.env.VINC_TENANT_ID || "hidros-it";
  const dbName = `vinc-${tenantId}`;

  console.log("Connecting to MongoDB...");
  console.log(`Database: ${dbName}`);
  await mongoose.connect(mongoUrl, { dbName });
  console.log("Connected\n");

  const users = await B2BUserModel.find({}).lean();

  if (users.length === 0) {
    console.log("No B2B users found.");
  } else {
    console.log("B2B Users:\n");
    console.log("-".repeat(80));
    for (const user of users) {
      console.log(`  ID:       ${user._id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email:    ${user.email}`);
      console.log(`  Role:     ${user.role}`);
      console.log(`  Company:  ${user.companyName}`);
      console.log(`  Active:   ${user.isActive}`);
      console.log("-".repeat(80));
    }

    console.log(`\nTo seed orders for a specific user, run:`);
    console.log(`  npx tsx scripts/seed-test-orders.ts --customer-id <ID> --clear`);
    console.log(`\nExample:`);
    console.log(`  npx tsx scripts/seed-test-orders.ts --customer-id ${users[0]._id} --clear`);
  }

  await mongoose.disconnect();
}

listUsers().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
