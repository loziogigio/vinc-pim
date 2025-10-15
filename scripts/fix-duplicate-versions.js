/**
 * MongoDB Cleanup Script: Fix Duplicate Version Numbers
 *
 * This script fixes the duplicate Version 7 entries in the home page document.
 * It will:
 * 1. Keep the first (older) Version 7 as-is
 * 2. Renumber the second Version 7 to Version 8
 * 3. Update currentVersion and currentPublishedVersion if needed
 *
 * Run this script using MongoDB shell or Node.js with MongoDB driver
 */

// For MongoDB shell (mongosh):
// mongosh "your-connection-string" --file scripts/fix-duplicate-versions.js

// For Node.js (using this as a guide):
const fixDuplicateVersions = async () => {
  // Connect to your MongoDB
  const { MongoClient } = require('mongodb');

  const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-connection-string';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(); // Uses database from connection string
    const pages = db.collection('pages');

    // Find the home page
    const homePage = await pages.findOne({ slug: 'home' });

    if (!homePage) {
      console.log('Home page not found');
      return;
    }

    console.log(`Found home page with ${homePage.versions.length} versions`);

    // Find duplicate version numbers
    const versionCounts = {};
    homePage.versions.forEach((v, index) => {
      const versionNum = v.version;
      if (!versionCounts[versionNum]) {
        versionCounts[versionNum] = [];
      }
      versionCounts[versionNum].push({ index, version: v });
    });

    // Check for duplicates
    const duplicates = Object.entries(versionCounts).filter(([_, versions]) => versions.length > 1);

    if (duplicates.length === 0) {
      console.log('No duplicate versions found!');
      return;
    }

    console.log(`Found duplicates for versions: ${duplicates.map(([v]) => v).join(', ')}`);

    // Fix duplicates
    let updatedVersions = [...homePage.versions];
    let maxVersionNumber = Math.max(...homePage.versions.map(v => v.version));

    duplicates.forEach(([versionNum, entries]) => {
      console.log(`\nFixing ${entries.length} duplicate entries for version ${versionNum}:`);

      // Keep the first one, renumber the rest
      entries.slice(1).forEach((entry) => {
        const oldIndex = entry.index;
        maxVersionNumber += 1;

        console.log(`  - Renumbering version at index ${oldIndex} from v${versionNum} to v${maxVersionNumber}`);
        console.log(`    Created: ${entry.version.createdAt}`);
        console.log(`    Blocks: ${entry.version.blocks.length}`);
        console.log(`    Status: ${entry.version.status}`);

        updatedVersions[oldIndex] = {
          ...entry.version,
          version: maxVersionNumber,
          comment: `Version ${maxVersionNumber} (renumbered from ${versionNum})`
        };
      });
    });

    // Determine the latest version and latest published version
    const latestVersion = Math.max(...updatedVersions.map(v => v.version));
    const latestPublishedVersion = Math.max(
      ...updatedVersions
        .filter(v => v.status === 'published')
        .map(v => v.version),
      0
    ) || undefined;

    console.log(`\nUpdating document:`);
    console.log(`  - Total versions: ${updatedVersions.length}`);
    console.log(`  - Latest version: ${latestVersion}`);
    console.log(`  - Latest published: ${latestPublishedVersion || 'none'}`);

    // Update the document
    const result = await pages.updateOne(
      { slug: 'home' },
      {
        $set: {
          versions: updatedVersions,
          currentVersion: latestVersion,
          currentPublishedVersion: latestPublishedVersion,
          updatedAt: new Date()
        }
      }
    );

    console.log(`\nUpdate result: ${result.modifiedCount} document(s) modified`);

    // Verify the fix
    const updatedPage = await pages.findOne({ slug: 'home' });
    const newVersionNumbers = updatedPage.versions.map(v => v.version).sort((a, b) => a - b);
    console.log(`\nVerification - Version numbers after fix: ${newVersionNumbers.join(', ')}`);

    // Check for remaining duplicates
    const uniqueVersions = new Set(newVersionNumbers);
    if (uniqueVersions.size !== newVersionNumbers.length) {
      console.error('ERROR: Duplicates still exist!');
    } else {
      console.log('SUCCESS: All version numbers are now unique!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
};

// If running directly with Node.js
if (require.main === module) {
  fixDuplicateVersions().catch(console.error);
}

module.exports = { fixDuplicateVersions };
