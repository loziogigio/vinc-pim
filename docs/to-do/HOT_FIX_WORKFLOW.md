# Hot Fix Workflow

## Overview

The **Hot Fix** feature allows you to make quick content updates to published versions without creating new versions. Perfect for typos, text changes, image swaps, and other minor edits.

## When to Use

### ✅ Use Hot Fix For:
- Fixing typos in published content
- Updating hero text or CTAs
- Swapping images
- Adjusting colors or minor styling
- Quick content refreshes
- Time-sensitive updates

### ❌ Use New Version For:
- Major redesigns
- Adding/removing blocks
- Structural changes
- A/B testing variations
- When you need version history

## How It Works

### Workflow Comparison

#### **Draft Version (Normal Workflow)**
```
┌─────────────────────────────────────┐
│  Version 3 (Draft)                  │
│  - 1 block: Product Slider          │
└─────────────────────────────────────┘
           ↓
    Make changes (edit text)
           ↓
    Click "Save"
           ↓
┌─────────────────────────────────────┐
│  Version 3 (Draft) - UPDATED        │
│  - 1 block: Product Slider (edited) │
└─────────────────────────────────────┘
           ↓
    Click "Publish"
           ↓
┌─────────────────────────────────────┐
│  Version 3 (Published)              │
│  - Goes live on website             │
└─────────────────────────────────────┘
```

#### **Published Version (Hot Fix Workflow)**
```
┌─────────────────────────────────────┐
│  Version 2 (Published) ✓ LIVE      │
│  - 1 block: Hero Split              │
└─────────────────────────────────────┘
           ↓
    Make changes (fix typo in hero)
           ↓
    Click "Hot Fix" 🔥
           ↓
┌─────────────────────────────────────┐
│  Version 2 (Published) ✓ LIVE      │
│  - 1 block: Hero Split (fixed!)    │
│  - lastSavedAt: updated             │
│  - STILL Version 2, no v3 created   │
└─────────────────────────────────────┘
```

## UI Behavior

### When Editing a Draft Version:
- **Save Button**: Orange - Updates the draft
- **Publish Button**: Green - Publishes the draft

### When Editing a Published Version:
- **Hot Fix Button**: Orange - Updates published version directly
- **Publish Button**: Hidden (version already published)
- **Info Banner**: Shows blue message explaining hot fix option

## Technical Details

### What Hot Fix Does:
1. Updates `blocks` array in the current version
2. Updates `seo` data if changed
3. Updates `lastSavedAt` timestamp
4. **Does NOT**:
   - Change version number
   - Change `publishedAt` date
   - Change `status` field
   - Create new version entry

### API Endpoint:
```typescript
POST /api/pages/hotfix
Body: {
  slug: "home",
  blocks: [...],
  seo: {...}
}
```

### Database Function:
```typescript
hotfixPage({ slug, blocks, seo })
```

### Validation:
- Only works on published versions
- Returns error if version is draft: "Use regular save for draft versions"
- Requires authenticated admin session

## Example Scenarios

### Scenario 1: Fix Typo in Hero
1. You notice "Welcom" instead of "Welcome" on live site
2. Navigate to admin page builder
3. Currently viewing Version 2 (Published)
4. Edit hero block, fix typo
5. Click **Hot Fix** button
6. ✅ Changes go live immediately as Version 2

### Scenario 2: Update Product Collection
1. You want to feature different products
2. Currently viewing Version 2 (Published)
3. Edit product slider block, change collection from "featured" to "new-arrivals"
4. Click **Hot Fix** button
5. ✅ New products appear on live site immediately

### Scenario 3: Seasonal Image Update
1. You want to swap hero background for summer season
2. Currently viewing Version 2 (Published)
3. Upload new seasonal image to hero block
4. Click **Hot Fix** button
5. ✅ New hero image is live immediately

## Best Practices

### ✅ Do:
- Use hot fix for minor content updates
- Test changes in Preview before applying hot fix
- Document significant hot fixes in team communications
- Keep hot fixes focused on content, not structure

### ❌ Don't:
- Use hot fix for major redesigns
- Apply hot fix without previewing first
- Use hot fix when you need to preserve old version
- Rely solely on hot fix for all changes (you'll lose history)

## Version History Impact

### Before Hot Fix:
```
Version 1 (Published) - 4 blocks
Version 2 (Published) ← Current ← Published
Version 3 (Draft) - 1 block
```

### After Hot Fix to Version 2:
```
Version 1 (Published) - 4 blocks
Version 2 (Published) ← Current ← Published [UPDATED via hot fix]
Version 3 (Draft) - 1 block
```

**Note**: Version 2 content is updated, but version number stays the same. No new version is created.

## Rollback Considerations

⚠️ **Important**: Hot fixes update the version in-place, meaning you lose the previous state of that version. If you need to roll back:

### Option 1: Load Previous Version
1. Open Version History
2. Click "Load" on Version 1
3. Click "Publish" to make it current

### Option 2: Create New Version First
If you're unsure about a change:
1. Click "New Version" instead of "Hot Fix"
2. Make your changes
3. Publish the new version
4. If something breaks, load the previous version

## Monitoring Hot Fixes

Check the `lastSavedAt` timestamp on published versions to see when hot fixes were applied:

```javascript
// In version history
{
  version: 2,
  status: "published",
  publishedAt: "2025-10-15T06:24:00Z",  // Original publish time
  lastSavedAt: "2025-10-15T14:30:00Z",  // Hot fix applied time
}
```

If `lastSavedAt` is newer than `publishedAt`, a hot fix was applied.
