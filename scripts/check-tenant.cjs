#!/usr/bin/env node
/**
 * Check Tenant Resources
 *
 * Verifies tenant exists in admin DB and checks associated resources:
 * - MongoDB database
 * - Solr collection/core
 * - Admin user
 * - Languages
 *
 * Usage:
 *   node scripts/check-tenant.cjs <tenant-id>
 *   node scripts/check-tenant.cjs df-it
 */

require('dotenv').config();
const mongoose = require('mongoose');

const ADMIN_DB = 'vinc-admin';
const SOLR_URL = process.env.SOLR_URL || 'http://149.81.163.109:8983/solr';

async function checkSolrCollection(collectionName) {
  try {
    const url = `${SOLR_URL}/admin/collections?action=LIST`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.collections && Array.isArray(data.collections)) {
      return data.collections.includes(collectionName);
    }
    return false;
  } catch (error) {
    console.error('Error checking Solr:', error.message);
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
  } catch (error) {
    console.error('Error checking MongoDB:', error.message);
    return false;
  }
}

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: node scripts/check-tenant.cjs <tenant-id>');
    process.exit(1);
  }

  console.log(`\n=== TENANT RESOURCE CHECK ===\n`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Expected DB: vinc-${tenantId}`);
  console.log(`Expected Solr: vinc-${tenantId}\n`);

  // Check admin database
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: ADMIN_DB,
  });

  const TenantSchema = new mongoose.Schema({}, { strict: false });
  const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema, 'tenants');

  const tenant = await Tenant.findOne({ tenant_id: tenantId }).exec();

  if (!tenant) {
    console.log('❌ Tenant NOT FOUND in admin database\n');
  } else {
    console.log('✅ Tenant found in admin database');
    console.log(`   Name: ${tenant.name}`);
    console.log(`   Status: ${tenant.status}`);
    console.log(`   Admin Email: ${tenant.admin_email}`);
    console.log(`   Mongo DB: ${tenant.mongo_db}`);
    console.log(`   Solr Core: ${tenant.solr_core}`);
    console.log(`   Created: ${tenant.created_at}\n`);
  }

  // Check MongoDB database
  const mongoDbName = `vinc-${tenantId}`;
  const mongoExists = await checkMongoDatabase(mongoDbName);

  if (mongoExists) {
    console.log(`✅ MongoDB database exists: ${mongoDbName}`);

    // Connect to tenant database and check collections
    const tenantConn = await mongoose.createConnection(process.env.VINC_MONGO_URL, {
      dbName: mongoDbName,
    }).asPromise();

    const collections = await tenantConn.db.listCollections().toArray();
    console.log(`   Collections: ${collections.map(c => c.name).join(', ')}`);

    // Check for admin user
    const B2BUserSchema = new mongoose.Schema({}, { strict: false });
    const B2BUser = tenantConn.model('B2BUser', B2BUserSchema, 'b2busers');
    const adminCount = await B2BUser.countDocuments();
    console.log(`   Admin users: ${adminCount}`);

    // Check for languages
    const LanguageSchema = new mongoose.Schema({}, { strict: false });
    const Language = tenantConn.model('Language', LanguageSchema, 'languages');
    const langCount = await Language.countDocuments();
    const enabledCount = await Language.countDocuments({ isEnabled: true });
    console.log(`   Languages: ${langCount} total, ${enabledCount} enabled\n`);

    await tenantConn.close();
  } else {
    console.log(`❌ MongoDB database NOT FOUND: ${mongoDbName}\n`);
  }

  // Check Solr collection
  const solrCore = `vinc-${tenantId}`;
  const solrExists = await checkSolrCollection(solrCore);

  if (solrExists) {
    console.log(`✅ Solr collection exists: ${solrCore}`);
    console.log(`   URL: ${SOLR_URL}/#/${solrCore}\n`);
  } else {
    console.log(`❌ Solr collection NOT FOUND: ${solrCore}\n`);
  }

  // Summary
  console.log('=== SUMMARY ===');
  const adminDbStatus = tenant ? '✅' : '❌';
  const mongoStatus = mongoExists ? '✅' : '❌';
  const solrStatus = solrExists ? '✅' : '❌';

  console.log(`${adminDbStatus} Admin DB record`);
  console.log(`${mongoStatus} MongoDB database`);
  console.log(`${solrStatus} Solr collection`);

  const allGone = !tenant && !mongoExists && !solrExists;
  const allPresent = tenant && mongoExists && solrExists;

  if (allGone) {
    console.log('\n✅ Tenant fully deleted - all resources removed');
  } else if (allPresent) {
    console.log('\n✅ Tenant fully provisioned - all resources present');
  } else {
    console.log('\n⚠️  Partial state - some resources missing');
  }

  await mongoose.connection.close();
}

main().catch(console.error);
