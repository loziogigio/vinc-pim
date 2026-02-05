#!/usr/bin/env node
/**
 * Clear all notifications and campaigns for a specific tenant
 * 
 * Usage: node scripts/clear-tenant-notifications.cjs <tenant-id>
 * Example: node scripts/clear-tenant-notifications.cjs hidros-it
 */

require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = process.argv[2];

if (!tenantId) {
  console.error('Usage: node scripts/clear-tenant-notifications.cjs <tenant-id>');
  process.exit(1);
}

const tenantDb = `vinc-${tenantId}`;
const adminDb = 'vinc-admin';

async function main() {
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    throw new Error('VINC_MONGO_URL not set');
  }

  console.log(`\n🗑️  Clearing notifications for tenant: ${tenantId}`);
  console.log(`   Tenant DB: ${tenantDb}`);
  console.log(`   Admin DB: ${adminDb}\n`);

  // Connect to MongoDB
  const conn = await mongoose.connect(mongoUrl);
  
  // Clear tenant database collections
  console.log('📦 Clearing tenant database collections...');
  const tenantConnection = conn.connection.useDb(tenantDb);
  
  // Clear campaigns
  const campaignsResult = await tenantConnection.collection('campaigns').deleteMany({});
  console.log(`   - campaigns: ${campaignsResult.deletedCount} deleted`);
  
  // Clear notifications (in-app notifications)
  try {
    const notificationsResult = await tenantConnection.collection('notifications').deleteMany({});
    console.log(`   - notifications: ${notificationsResult.deletedCount} deleted`);
  } catch (e) {
    console.log(`   - notifications: collection not found (skipped)`);
  }

  // Clear admin database collections (filtered by tenant)
  console.log('\n📦 Clearing admin database collections...');
  const adminConnection = conn.connection.useDb(adminDb);
  
  // Clear email logs for this tenant
  const emailLogsResult = await adminConnection.collection('emaillogs').deleteMany({ tenant_db: tenantDb });
  console.log(`   - emaillogs: ${emailLogsResult.deletedCount} deleted`);
  
  // Clear notification logs for this tenant
  const notificationLogsResult = await adminConnection.collection('notificationlogs').deleteMany({ tenant_db: tenantDb });
  console.log(`   - notificationlogs: ${notificationLogsResult.deletedCount} deleted`);

  console.log('\n✅ Done! All notifications and campaigns cleared.\n');
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
