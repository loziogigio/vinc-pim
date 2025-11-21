/**
 * Reset B2B User Password Script
 * Resets the password for an existing B2B user
 *
 * Usage:
 *   npx tsx scripts/reset-b2b-password.ts <tenant-id> [username]
 *   npx tsx scripts/reset-b2b-password.ts hidros-it
 *   npx tsx scripts/reset-b2b-password.ts hidros-it custom_user
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { B2BUserModel } from "../src/lib/db/models/b2b-user.js";
import { runScript } from "./lib/db-connect.js";

// Get username from CLI arguments or use default
const USERNAME = process.argv[3] || "b2b_admin";

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

  // Find existing user
  const user = await B2BUserModel.findOne({ username: USERNAME });

  if (!user) {
    console.log(`\n❌ User '${USERNAME}' not found in ${dbName}`);
    console.log(`Run: npx tsx scripts/seed-b2b-user.ts ${tenantId} to create the user\n`);
    process.exit(1);
  }

  // Generate new password and hash it
  const password = generateRandomPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  // Update user password
  user.passwordHash = passwordHash;
  await user.save();

  console.log(`\n✅ Password reset successful for tenant: ${tenantId}`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 NEW LOGIN CREDENTIALS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Tenant:   ${tenantId}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${USERNAME}`);
  console.log(`   Password: ${password}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n🌐 Access: http://localhost:3001/api/b2b/login`);
  console.log(`\n⚠️  SAVE THIS PASSWORD - It won't be shown again!`);
});
