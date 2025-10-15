# Database Maintenance Scripts

## Fix Current Version Mismatch

If your `currentVersion` field doesn't match the latest version in your versions array (e.g., `currentVersion: 2` but Version 3 exists), use this script.

### How to run:

```bash
# From the project root
cd vinc-storefront
MONGODB_URI="your-connection-string" node scripts/fix-current-version.js
```

### What it does:

1. Finds the maximum version number in the versions array
2. Updates `currentVersion` to that maximum
3. Updates `currentPublishedVersion` to the latest published version (if any)

---

## Fix Duplicate Versions

If you have duplicate version numbers in your page versions (e.g., two "Version 7" entries), use this script to fix the data.

### What it does:

1. Finds all duplicate version numbers in the `home` page document
2. Keeps the first (oldest) version with that number
3. Renumbers subsequent duplicates to the next available version number
4. Updates `currentVersion` and `currentPublishedVersion` accordingly

### How to run:

**Option 1: Using Node.js**

```bash
# From the project root
cd vinc-storefront
node scripts/fix-duplicate-versions.js
```

**Option 2: Using MongoDB Shell (mongosh)**

```bash
# Copy the logic from the script and run it directly in mongosh
mongosh "your-connection-string"
```

Then adapt the script's logic for the mongosh environment.

**Option 3: Manual fix via MongoDB Compass or Atlas UI**

1. Connect to your MongoDB database
2. Open the `pages` collection
3. Find the document with `slug: "home"`
4. Look at the `versions` array
5. Manually renumber any duplicate version numbers
6. Update `currentVersion` to the highest version number
7. Update `currentPublishedVersion` to the highest published version number

### After running the script:

1. Refresh your admin page builder
2. Open the Version History modal
3. Verify that all version numbers are unique
4. The duplicate Version 7 should now be Version 8 (or the next sequential number)

### Example output:

```
Connected to MongoDB
Found home page with 4 versions

Found duplicates for versions: 7

Fixing 2 duplicate entries for version 7:
  - Renumbering version at index 3 from v7 to v8
    Created: 2025-10-15T04:23:49.931Z
    Blocks: 1
    Status: published

Updating document:
  - Total versions: 4
  - Latest version: 8
  - Latest published: 8

Update result: 1 document(s) modified

Verification - Version numbers after fix: 1, 6, 7, 8
SUCCESS: All version numbers are now unique!
```
