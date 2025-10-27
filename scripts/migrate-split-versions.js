import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const MONGO_DB = process.env.VINC_MONGO_DB || 'hdr-api-it';
const OLD_COLLECTION = 'b2bhometemplates';
const NEW_COLLECTION = 'b2bhometemplates_new';

async function migrateVersions() {
  let client;

  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db(MONGO_DB);
    const oldCollection = db.collection(OLD_COLLECTION);
    const newCollection = db.collection(NEW_COLLECTION);

    // Get all template documents
    const templates = await oldCollection.find({}).toArray();
    console.log(`Found ${templates.length} template document(s)\n`);

    let totalVersions = 0;

    for (const template of templates) {
      console.log(`Processing template: ${template.templateId}`);

      if (!template.versions || !Array.isArray(template.versions)) {
        console.log('  No versions array found, skipping\n');
        continue;
      }

      console.log(`  Found ${template.versions.length} version(s)`);

      // Create a separate document for each version
      for (const version of template.versions) {
        const newDoc = {
          templateId: template.templateId,
          name: template.name,
          version: version.version,
          status: version.status || 'draft',
          blocks: version.blocks || [],
          seo: version.seo || {},
          label: version.label || version.comment || `Version ${version.version}`,
          comment: version.comment,
          createdAt: version.createdAt || template.createdAt,
          createdBy: version.createdBy || 'system',
          lastSavedAt: version.lastSavedAt,
          publishedAt: version.publishedAt,
          priority: version.priority || 0,
          isDefault: version.isDefault || false,
          tags: version.tags || (version.tag ? { campaign: version.tag } : undefined),
          activeFrom: version.activeFrom,
          activeTo: version.activeTo,
          // Keep reference to original document
          migratedFrom: template._id,
          migratedAt: new Date()
        };

        // Mark current version
        if (template.currentVersion === version.version) {
          newDoc.isCurrent = true;
        }

        // Mark current published version
        if (template.currentPublishedVersion === version.version) {
          newDoc.isCurrentPublished = true;
        }

        await newCollection.insertOne(newDoc);
        console.log(`    ✓ Created document for version ${version.version} (status: ${newDoc.status})`);
        totalVersions++;
      }

      console.log('');
    }

    console.log(`\n✓ Migration complete!`);
    console.log(`  Total versions migrated: ${totalVersions}`);
    console.log(`  New collection: ${NEW_COLLECTION}`);
    console.log(`\nTo finalize migration:`);
    console.log(`  1. Verify data in ${NEW_COLLECTION}`);
    console.log(`  2. Rename ${NEW_COLLECTION} to ${OLD_COLLECTION}:`);
    console.log(`     db.${OLD_COLLECTION}.renameCollection('${OLD_COLLECTION}_backup')`);
    console.log(`     db.${NEW_COLLECTION}.renameCollection('${OLD_COLLECTION}')`);

  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\nMongoDB connection closed');
    }
  }
}

migrateVersions();
