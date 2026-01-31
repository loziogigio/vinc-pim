#!/usr/bin/env node
/**
 * Test Tenant API
 *
 * Creates a temporary super admin, tests the tenant creation/deletion API,
 * and cleans up the super admin afterward.
 *
 * Usage:
 *   node scripts/test-tenant-api.cjs
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ADMIN_DB = 'vinc-admin';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TENANT_ID = 'test-api-' + Date.now().toString(36);
const SOLR_URL = process.env.SOLR_URL || 'http://149.81.163.109:8983/solr';

// Test super admin credentials
const TEST_ADMIN = {
  email: 'test-admin@lifecycle.test',
  password: 'TestAdmin123!',
  name: 'Test Admin',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function checkSolrCollection(collectionName) {
  try {
    const url = `${SOLR_URL}/admin/collections?action=LIST`;
    const response = await fetch(url);
    const data = await response.json();
    return data.collections?.includes(collectionName) || false;
  } catch {
    return false;
  }
}

async function checkMongoDatabase(dbName) {
  try {
    const connection = await mongoose.createConnection(process.env.VINC_MONGO_URL).asPromise();
    const admin = connection.db.admin();
    const result = await admin.listDatabases();
    await connection.close();
    return result.databases.some(db => db.name === dbName);
  } catch {
    return false;
  }
}

async function getTenantCounts(dbName) {
  const conn = await mongoose.createConnection(process.env.VINC_MONGO_URL, { dbName }).asPromise();

  const B2BUser = conn.model('B2BUser', new mongoose.Schema({}, { strict: false }), 'b2busers');
  const Language = conn.model('Language', new mongoose.Schema({}, { strict: false }), 'languages');
  const Template = conn.model('NotificationTemplate', new mongoose.Schema({}, { strict: false }), 'notificationtemplates');
  const HomeSettings = conn.model('B2BHomeSettings', new mongoose.Schema({}, { strict: false }), 'b2bhomesettings');

  const [adminCount, langCount, enabledLangs, templateCount, campaignCount, homeSettings] = await Promise.all([
    B2BUser.countDocuments(),
    Language.countDocuments(),
    Language.countDocuments({ isEnabled: true }),
    Template.countDocuments(),
    Template.countDocuments({ template_id: { $regex: /^campaign-/ } }),
    HomeSettings.findOne().lean(),
  ]);

  const hasHomeSettings = !!homeSettings;
  const headerRowCount = homeSettings?.headerConfig?.rows?.length || 0;

  await conn.close();
  return { adminCount, langCount, enabledLangs, templateCount, campaignCount, hasHomeSettings, headerRowCount };
}

// ============================================
// MAIN TEST
// ============================================

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('TENANT API TEST');
  console.log(`${'='.repeat(60)}\n`);

  const tenantId = TEST_TENANT_ID;
  const dbName = `vinc-${tenantId}`;

  console.log(`Test Tenant ID: ${tenantId}`);
  console.log(`API Base: ${API_BASE}\n`);

  // Connect to admin DB
  await mongoose.connect(process.env.VINC_MONGO_URL, { dbName: ADMIN_DB });

  // ============================================
  // STEP 1: CREATE TEMPORARY SUPER ADMIN
  // ============================================
  console.log(`${'─'.repeat(60)}`);
  console.log('STEP 1: CREATE TEMPORARY SUPER ADMIN');
  console.log(`${'─'.repeat(60)}\n`);

  const SuperAdminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password_hash: { type: String, required: true },
    name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    last_login: { type: Date },
    created_at: { type: Date, default: Date.now },
  }, { collection: 'superadmins' });

  SuperAdminSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password_hash);
  };

  const SuperAdmin = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', SuperAdminSchema);

  // Remove existing test admin if any
  await SuperAdmin.deleteOne({ email: TEST_ADMIN.email });

  // Create test admin
  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, 12);
  const testAdmin = await SuperAdmin.create({
    email: TEST_ADMIN.email,
    password_hash: passwordHash,
    name: TEST_ADMIN.name,
    is_active: true,
  });
  console.log(`✅ Created test super admin: ${TEST_ADMIN.email}`);

  // ============================================
  // STEP 2: LOGIN TO GET SESSION COOKIE
  // ============================================
  console.log(`\n${'─'.repeat(60)}`);
  console.log('STEP 2: LOGIN TO GET SESSION COOKIE');
  console.log(`${'─'.repeat(60)}\n`);

  const loginResponse = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
  });

  if (!loginResponse.ok) {
    const err = await loginResponse.json();
    console.log(`❌ Login failed: ${err.error}`);
    await SuperAdmin.deleteOne({ email: TEST_ADMIN.email });
    await mongoose.connection.close();
    process.exit(1);
  }

  // Extract session cookie
  const cookies = loginResponse.headers.get('set-cookie');
  const sessionCookie = cookies?.split(';')[0];
  console.log(`✅ Login successful`);
  console.log(`   Cookie: ${sessionCookie?.substring(0, 50)}...`);

  // ============================================
  // STEP 3: CREATE TENANT VIA API
  // ============================================
  console.log(`\n${'─'.repeat(60)}`);
  console.log('STEP 3: CREATE TENANT VIA API');
  console.log(`${'─'.repeat(60)}\n`);

  const createResponse = await fetch(`${API_BASE}/api/admin/tenants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      name: 'Test API Tenant',
      admin_email: 'admin@test-api.com',
      admin_password: 'TestPass123!',
    }),
  });

  const createResult = await createResponse.json();

  if (!createResponse.ok) {
    console.log(`❌ Create failed: ${createResult.error}`);
    await SuperAdmin.deleteOne({ email: TEST_ADMIN.email });
    await mongoose.connection.close();
    process.exit(1);
  }

  console.log(`✅ Tenant created successfully`);
  console.log(`   Tenant ID: ${createResult.tenant.tenant_id}`);
  console.log(`   Access URL: ${createResult.access_url}`);

  // ============================================
  // STEP 4: VERIFY TENANT RESOURCES
  // ============================================
  console.log(`\n${'─'.repeat(60)}`);
  console.log('STEP 4: VERIFY TENANT RESOURCES');
  console.log(`${'─'.repeat(60)}\n`);

  const mongoExists = await checkMongoDatabase(dbName);
  const solrExists = await checkSolrCollection(dbName);

  console.log(`MongoDB database: ${mongoExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  console.log(`Solr collection:  ${solrExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);

  if (mongoExists) {
    const counts = await getTenantCounts(dbName);
    console.log(`\nDatabase contents:`);
    console.log(`  Admin users: ${counts.adminCount}`);
    console.log(`  Languages: ${counts.langCount} total, ${counts.enabledLangs} enabled`);
    console.log(`  Templates: ${counts.templateCount} total (${counts.campaignCount} campaign)`);
    console.log(`  Home settings: ${counts.hasHomeSettings ? 'present' : 'missing'} (header: ${counts.headerRowCount} rows)`);

    // Verify expected counts
    const expectedLangs = 43;
    const expectedTemplates = 15;
    const expectedCampaign = 2;
    const expectedHeaderRows = 2;

    if (counts.langCount === expectedLangs) {
      console.log(`  ✅ Language count correct (${expectedLangs})`);
    } else {
      console.log(`  ⚠️  Language count: expected ${expectedLangs}, got ${counts.langCount}`);
    }

    if (counts.templateCount === expectedTemplates) {
      console.log(`  ✅ Template count correct (${expectedTemplates})`);
    } else {
      console.log(`  ⚠️  Template count: expected ${expectedTemplates}, got ${counts.templateCount}`);
    }

    if (counts.campaignCount === expectedCampaign) {
      console.log(`  ✅ Campaign template count correct (${expectedCampaign})`);
    } else {
      console.log(`  ⚠️  Campaign count: expected ${expectedCampaign}, got ${counts.campaignCount}`);
    }

    if (counts.hasHomeSettings && counts.headerRowCount === expectedHeaderRows) {
      console.log(`  ✅ Home settings with header (${expectedHeaderRows} rows)`);
    } else if (!counts.hasHomeSettings) {
      console.log(`  ⚠️  Home settings: expected present, got missing`);
    } else {
      console.log(`  ⚠️  Header rows: expected ${expectedHeaderRows}, got ${counts.headerRowCount}`);
    }
  }

  // ============================================
  // STEP 5: DELETE TENANT VIA API
  // ============================================
  console.log(`\n${'─'.repeat(60)}`);
  console.log('STEP 5: DELETE TENANT VIA API');
  console.log(`${'─'.repeat(60)}\n`);

  const deleteResponse = await fetch(`${API_BASE}/api/admin/tenants/${tenantId}?confirm=yes`, {
    method: 'DELETE',
    headers: { 'Cookie': sessionCookie },
  });

  const deleteResult = await deleteResponse.json();

  if (!deleteResponse.ok) {
    console.log(`❌ Delete failed: ${deleteResult.error}`);
  } else {
    console.log(`✅ Tenant deleted successfully`);
  }

  // ============================================
  // STEP 6: VERIFY DELETION
  // ============================================
  console.log(`\n${'─'.repeat(60)}`);
  console.log('STEP 6: VERIFY DELETION');
  console.log(`${'─'.repeat(60)}\n`);

  const finalMongoExists = await checkMongoDatabase(dbName);
  const finalSolrExists = await checkSolrCollection(dbName);

  console.log(`MongoDB database: ${finalMongoExists ? '❌ STILL EXISTS' : '✅ REMOVED'}`);
  console.log(`Solr collection:  ${finalSolrExists ? '❌ STILL EXISTS' : '✅ REMOVED'}`);

  // ============================================
  // CLEANUP: REMOVE TEST SUPER ADMIN
  // ============================================
  console.log(`\n${'─'.repeat(60)}`);
  console.log('CLEANUP: REMOVE TEST SUPER ADMIN');
  console.log(`${'─'.repeat(60)}\n`);

  await SuperAdmin.deleteOne({ email: TEST_ADMIN.email });
  console.log(`✅ Test super admin removed`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  const creationSuccess = mongoExists && solrExists;
  const deletionSuccess = !finalMongoExists && !finalSolrExists;
  const allPassed = creationSuccess && deletionSuccess;

  console.log(`Creation via API:  ${creationSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Deletion via API:  ${deletionSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  await mongoose.connection.close();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\n❌ Test failed with error:', err);

  // Cleanup on error
  try {
    const SuperAdmin = mongoose.models.SuperAdmin;
    if (SuperAdmin) {
      await SuperAdmin.deleteOne({ email: TEST_ADMIN.email });
    }
    await mongoose.connection.close();
  } catch {}

  process.exit(1);
});
