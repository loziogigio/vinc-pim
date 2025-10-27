# Home Template Migration Guide

## Overview

This document describes the migration from a nested version structure to a flat document structure for the `b2bhometemplates` MongoDB collection.

## Previous Structure

Previously, all versions were stored in a single document:

```javascript
{
  _id: ObjectId,
  templateId: "home-page",
  name: "Home Page",
  versions: [
    { version: 1, blocks: [...], status: "published", ... },
    { version: 2, blocks: [...], status: "draft", ... }
  ],
  currentVersion: 2,
  currentPublishedVersion: 1
}
```

## New Structure

Now, each version is stored as a separate document:

```javascript
// Document 1 (Version 1 - Published)
{
  _id: ObjectId,
  templateId: "home-page",
  name: "Home Page",
  version: 1,
  blocks: [...],
  status: "published",
  isCurrent: false,
  isCurrentPublished: true,
  isDefault: true,
  ...
}

// Document 2 (Version 2 - Draft)
{
  _id: ObjectId,
  templateId: "home-page",
  name: "Home Page",
  version: 2,
  blocks: [...],
  status: "draft",
  isCurrent: true,
  isCurrentPublished: false,
  ...
}
```

## Key Changes

### New Fields

- `isCurrent` - Boolean flag marking the current working version
- `isCurrentPublished` - Boolean flag marking the current published version
- `migratedFrom` - Reference to original document (for tracking)
- `migratedAt` - Timestamp of migration

### Removed Fields

From individual documents:
- `versions` array (no longer nested)
- `currentVersion` number
- `currentPublishedVersion` number

### Indexes

Added compound indexes for efficient queries:
- `{ templateId: 1, version: 1 }` - Unique constraint
- `{ templateId: 1, isCurrent: 1 }` - Fast current version lookup
- `{ templateId: 1, isCurrentPublished: 1 }` - Fast published version lookup

## Files Updated

### vinc-storefront

1. **src/lib/db/models/home-template.ts**
   - Updated `HomeTemplateDocument` interface to flat structure
   - Removed `VersionSchema`
   - Updated `HomeTemplateSchema` to flat structure with new fields
   - Added compound indexes

2. **src/lib/db/init-home-template.ts**
   - Creates single flat document instead of document with versions array
   - Sets `isCurrent: true` on initial document

3. **src/lib/db/home-templates.ts**
   - Completely rewritten all functions to work with flat structure
   - `getHomeTemplateConfig()` - Fetches all documents and formats as versions array for backward compatibility
   - `saveHomeTemplateDraft()` - Updates the current document
   - `publishHomeTemplate()` - Updates current document status and manages flags
   - `loadHomeTemplateVersion()` - Changes which document has `isCurrent: true`
   - `startNewHomeTemplateVersion()` - Creates new document
   - `deleteHomeTemplateVersion()` - Deletes a document
   - `duplicateHomeTemplateVersion()` - Creates new document
   - `renameHomeTemplateVersion()` - Updates document label
   - `publishHomeTemplateVersion()` - Publishes specific document
   - `unpublishHomeTemplateVersion()` - Unpublishes document
   - `getPublishedHomeTemplate()` - Finds document with `isCurrentPublished: true`
   - `getLatestHomeTemplateVersion()` - Finds document with `isCurrent: true`

### customer_web

1. **src/lib/db/models/home-template.ts**
   - Same changes as vinc-storefront model

2. **src/lib/db/home-templates.ts**
   - `getPublishedHomeTemplate()` - Fetches all documents and uses version resolver
   - `getLatestHomeTemplateVersion()` - Fetches all documents and uses version resolver

### Scripts

1. **scripts/migrate-split-versions.js**
   - Migrates old structure to new structure
   - Creates `b2bhometemplates_new` collection
   - Preserves all metadata and flags

2. **scripts/import-brands-to-carousel.js**
   - Updated to query `isCurrent: true` instead of versions array
   - Changed from `versions.$[].blocks.$[block]` to `blocks.$[block]`

3. **scripts/import-flyers-to-carousel.js**
   - Same updates as brands script

## Migration Process

### Step 1: Run Migration Script ✅ COMPLETED

```bash
cd /home/jire87/software/www-website/www-data/vendereincloud-app/vinc-apps/vinc-storefront
node scripts/migrate-split-versions.js
```

This creates `b2bhometemplates_new` collection with migrated data.

### Step 2: Verify Migration ✅ COMPLETED

The migration was verified and successfully created 2 documents:
- Version 1: 8 blocks, published, isCurrentPublished=true
- Version 2: 1 block, published, isCurrent=true

### Step 3: Update Code ✅ COMPLETED

All code has been updated in both vinc-storefront and customer_web.

### Step 4: Test Updated Code ⏳ PENDING

Before finalizing, test the following:

#### vinc-storefront Tests

1. **Load Page Builder**
   ```
   Visit: http://localhost:3000/b2b/home-builder
   Expected: Page builder loads with 2 versions shown
   ```

2. **Save Draft**
   - Make changes to current version
   - Click Save
   - Expected: Changes saved successfully, no errors

3. **Publish Version**
   - Publish current draft
   - Expected: Version published, isCurrentPublished flag updated

4. **Create New Version**
   - Click "Start New Version"
   - Expected: New version 3 created as draft

5. **Load Historical Version**
   - Select version 1 from history
   - Expected: Version 1 becomes current, can edit it

6. **Duplicate Version**
   - Duplicate version 1
   - Expected: New version created as copy

7. **Delete Version**
   - Delete a non-current, non-published version
   - Expected: Version deleted successfully

#### customer_web Tests

1. **Load Home Page**
   ```
   Visit: http://localhost:3000/
   Expected: Home page loads with published template blocks
   ```

2. **Load with Preview**
   ```
   Visit: http://localhost:3000/?preview=true
   Expected: Home page loads with current draft version
   ```

3. **Load with Tags**
   ```
   Visit: http://localhost:3000/?campaign=test&segment=vip
   Expected: Home page loads version matching tags (if any)
   ```

#### Script Tests

1. **Import Brands**
   ```bash
   node scripts/import-brands-to-carousel.js
   ```
   Expected: Brands imported successfully into carousel block

2. **Import Flyers**
   ```bash
   node scripts/import-flyers-to-carousel.js <BLOCK_ID>
   ```
   Expected: Flyers imported successfully into carousel block

### Step 5: Finalize Migration ⏳ PENDING

**ONLY after testing is successful**, finalize by renaming collections:

```javascript
// In MongoDB shell or Compass
use hdr-api-it

// Backup old collection
db.b2bhometemplates.renameCollection('b2bhometemplates_backup_20251027')

// Promote new collection
db.b2bhometemplates_new.renameCollection('b2bhometemplates')
```

### Step 6: Deploy ⏳ PENDING

After finalization:

1. Restart vinc-storefront application
2. Restart customer_web application
3. Verify production functionality

## Rollback Plan

If issues occur after deployment:

```javascript
// In MongoDB shell or Compass
use hdr-api-it

// Restore old collection
db.b2bhometemplates.renameCollection('b2bhometemplates_failed')
db.b2bhometemplates_backup_20251027.renameCollection('b2bhometemplates')
```

Then revert code changes using git:

```bash
# vinc-storefront
cd /home/jire87/software/www-website/www-data/vendereincloud-app/vinc-apps/vinc-storefront
git checkout HEAD~1 src/lib/db/models/home-template.ts
git checkout HEAD~1 src/lib/db/init-home-template.ts
git checkout HEAD~1 src/lib/db/home-templates.ts

# customer_web
cd /home/jire87/software/www-website/www-data/hidros-app/customer_web
git checkout HEAD~1 src/lib/db/models/home-template.ts
git checkout HEAD~1 src/lib/db/home-templates.ts
```

## Benefits of New Structure

1. **Better Scalability** - No document size limits from versions array
2. **Simpler Queries** - Direct document queries instead of array operations
3. **Better Indexing** - Can index version-specific fields
4. **Atomic Operations** - Updates to one version don't affect others
5. **Clearer Data Model** - Each version is independent entity

## API Compatibility

The public APIs remain unchanged:
- `getPublishedHomeTemplate()` - Still returns same format
- `getLatestHomeTemplateVersion()` - Still returns same format
- `getHomeTemplateConfig()` - Still returns PageConfig with versions array

This ensures backward compatibility with existing frontend code.

## Notes

- The migration preserves all metadata (tags, priority, activeFrom, activeTo, etc.)
- Version numbers remain sequential and unique per templateId
- The page builder UI is unchanged - it continues to work with the same API
- Import scripts now work with the new structure
- All version resolution logic (tags, priority, activeFrom/activeTo) continues to work

## Support

For issues or questions, please contact the development team.

**Last Updated:** 2025-10-27
