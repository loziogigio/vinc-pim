/**
 * MongoDB Cleanup Script: Fix currentVersion Mismatch
 *
 * This script fixes the currentVersion field when it doesn't match the latest version.
 * In your case: currentVersion is 2, but Version 3 exists in the array.
 *
 * The script will set currentVersion to the highest version number in the versions array.
 */

const { MongoClient } = require('mongodb');

const fixCurrentVersion = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI environment variable not set');
    console.log('Usage: MONGODB_URI="your-connection-string" node scripts/fix-current-version.js');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db();
    const pages = db.collection('pages');

    // Find the home page
    const homePage = await pages.findOne({ slug: 'home' });

    if (!homePage) {
      console.log('Home page not found');
      return;
    }

    console.log('Current state:');
    console.log(`  - slug: ${homePage.slug}`);
    console.log(`  - currentVersion: ${homePage.currentVersion}`);
    console.log(`  - currentPublishedVersion: ${homePage.currentPublishedVersion || 'none'}`);
    console.log(`  - versions in array: ${homePage.versions.map(v => v.version).join(', ')}`);

    // Calculate what currentVersion should be
    const maxVersion = Math.max(...homePage.versions.map(v => v.version));
    const latestPublishedVersion = Math.max(
      ...homePage.versions.filter(v => v.status === 'published').map(v => v.version),
      0
    ) || undefined;

    console.log('\nCalculated correct values:');
    console.log(`  - currentVersion should be: ${maxVersion}`);
    console.log(`  - currentPublishedVersion should be: ${latestPublishedVersion || 'none'}`);

    if (homePage.currentVersion === maxVersion && homePage.currentPublishedVersion === latestPublishedVersion) {
      console.log('\n✓ No fix needed - values are already correct!');
      return;
    }

    console.log('\nApplying fix...');

    // Update the document
    const result = await pages.updateOne(
      { slug: 'home' },
      {
        $set: {
          currentVersion: maxVersion,
          currentPublishedVersion: latestPublishedVersion,
          updatedAt: new Date()
        }
      }
    );

    console.log(`Update result: ${result.modifiedCount} document(s) modified`);

    // Verify
    const updatedPage = await pages.findOne({ slug: 'home' });
    console.log('\nVerification - Updated state:');
    console.log(`  - currentVersion: ${updatedPage.currentVersion}`);
    console.log(`  - currentPublishedVersion: ${updatedPage.currentPublishedVersion || 'none'}`);
    console.log(`  - versions in array: ${updatedPage.versions.map(v => v.version).join(', ')}`);

    console.log('\n✓ SUCCESS: currentVersion has been corrected!');
    console.log('\nNext steps:');
    console.log('  1. Refresh your admin page builder');
    console.log('  2. You should now see the correct version being edited');
    console.log(`  3. Version ${maxVersion} should be marked as "Current"`);

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
};

// Run if executed directly
if (require.main === module) {
  fixCurrentVersion().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixCurrentVersion };
