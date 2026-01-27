#!/usr/bin/env vite-node
/**
 * Send Test Push Notification
 *
 * Sends a test push notification to all active subscriptions for a tenant.
 *
 * Usage:
 *   pnpm dotenv -e .env -o -- vite-node scripts/send-test-push.ts
 *   pnpm dotenv -e .env -o -- vite-node scripts/send-test-push.ts --tenant hidros-it
 *   pnpm dotenv -e .env -o -- vite-node scripts/send-test-push.ts --tenant hidros-it --user jiresse@msn.com
 */

import mongoose from "mongoose";
import { sendPush, getActiveSubscriptions } from "../src/lib/push";

// ============================================
// CONFIG
// ============================================

const DEFAULT_TENANT = "hidros-it";

// Parse CLI args
function parseArgs(): { tenant: string; userEmail?: string } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf("--tenant");
  const userIndex = args.indexOf("--user");

  const tenant =
    tenantIndex >= 0 && args[tenantIndex + 1]
      ? args[tenantIndex + 1]
      : DEFAULT_TENANT;

  const userEmail =
    userIndex >= 0 && args[userIndex + 1] ? args[userIndex + 1] : undefined;

  return { tenant, userEmail };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const { tenant, userEmail } = parseArgs();
  const tenantDb = `vinc-${tenant}`;

  console.log("═".repeat(60));
  console.log("  Send Test Push Notification");
  console.log("═".repeat(60));
  console.log(`\n🏢 Tenant: ${tenant}`);
  console.log(`📦 Database: ${tenantDb}`);
  if (userEmail) {
    console.log(`👤 Filter by user: ${userEmail}`);
  }

  try {
    // Get active subscriptions
    const subscriptions = await getActiveSubscriptions(tenantDb);

    console.log(`\n📋 Found ${subscriptions.length} active subscription(s)`);

    if (subscriptions.length === 0) {
      console.log("⚠️  No active subscriptions found. Subscribe first via the browser.");
      await mongoose.disconnect();
      process.exit(0);
    }

    // Show subscriptions
    subscriptions.forEach((sub, i) => {
      console.log(`   ${i + 1}. User: ${sub.user_id || "anonymous"}`);
      console.log(`      Device: ${sub.device_type || "unknown"}`);
      console.log(`      Endpoint: ${sub.endpoint.substring(0, 50)}...`);
    });

    // Send test push to all subscriptions
    console.log("\n📤 Sending test push notification...\n");

    const result = await sendPush({
      tenantDb,
      title: "🔔 Test Notification",
      body: `This is a test push from ${tenant} at ${new Date().toLocaleTimeString()}`,
      icon: "/icons/icon-192x192.png",
      action_url: "/b2b/orders",
      preferenceType: "system", // System notifications
      queue: false, // Send immediately
    });

    console.log("═".repeat(60));
    console.log("  Results");
    console.log("═".repeat(60));
    console.log(`   ✅ Sent: ${result.sent}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log(`   📦 Queued: ${result.queued}`);

    if (result.errors?.length) {
      console.log("\n   Errors:");
      result.errors.forEach((err, i) => {
        console.log(`     ${i + 1}. ${err}`);
      });
    }

    if (result.sent > 0) {
      console.log("\n✅ Push notification sent successfully!");
      console.log("   Check your browser for the notification.");
    } else if (result.failed > 0) {
      console.log("\n⚠️  Push delivery failed. This could mean:");
      console.log("   - The browser subscription has expired");
      console.log("   - The user has blocked notifications");
      console.log("   - VAPID keys mismatch");
    }

    console.log("\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main();
