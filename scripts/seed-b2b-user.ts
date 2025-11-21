/**
 * Seed B2B User Script
 * Creates a B2B user account with random password
 *
 * Usage:
 *   npx tsx scripts/seed-b2b-user.ts <tenant-id>
 *   npx tsx scripts/seed-b2b-user.ts hidros-it
 *
 * Note: This script connects to the tenant-specific database.
 * Each tenant has their own database: vinc-{tenant-id}
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { B2BUserModel } from "../src/lib/db/models/b2b-user.js";
import { runScript } from "./lib/db-connect.js";

// Generate random password
function generateRandomPassword(length = 16): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from(crypto.randomBytes(length))
    .map((byte) => chars[byte % chars.length])
    .join("");
}

// Main script logic
runScript(async (tenantId) => {
  const dbName = `vinc-${tenantId}`;

  // Create B2B user with random password
  const username = "b2b_admin";
  const password = generateRandomPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const existingUser = await B2BUserModel.findOne({ username });

  if (existingUser) {
    console.log(`\n⚠️  User '${username}' already exists in ${dbName}`);
    console.log(`Delete the user first if you want to recreate it.\n`);
    return;
  }

  await B2BUserModel.create({
    username,
    email: `admin@${tenantId}.com`,
    passwordHash,
    role: "admin",
    companyName: tenantId.toUpperCase(),
    isActive: true,
  });

  console.log(`\n✅ Created B2B admin user for tenant: ${tenantId}`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 LOGIN CREDENTIALS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Tenant:   ${tenantId}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n🌐 Access: http://localhost:3001/api/b2b/login`);
  console.log(`\n⚠️  SAVE THIS PASSWORD - It won't be shown again!`);
});
