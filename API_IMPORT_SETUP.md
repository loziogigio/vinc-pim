# API Import Setup Guide

## Problem Summary

You had an API import source configured but:
1. ❌ **No import jobs** - The API import was never triggered
2. ❌ **No products** - No data was imported from the API
3. ❌ **Missing API config** - The import source model was missing `api_config` field

## What Was Fixed

### 1. Updated Import Source Model

Added `api_config` field to support API imports:

```typescript
api_config?: {
  endpoint: string;           // API URL
  method: "GET" | "POST";     // HTTP method
  headers?: Record<string, string>;  // Headers (auth, content-type)
  params?: Record<string, string>;   // Query parameters
  auth_type?: "none" | "bearer" | "api_key" | "basic";
  auth_token?: string;        // Authentication token
  schedule_cron?: string;     // Auto-import schedule
}
```

**File:** `src/lib/db/models/import-source.ts`

### 2. Added API Configuration to Source

Your `api-supplier-1` source now has:
- Endpoint: `https://api.example.com/products`
- Method: GET
- Schedule: Every 6 hours
- 17 field mappings configured

### 3. Created Trigger Endpoint

**API:** `POST /api/b2b/pim/sources/[source_id]/trigger`

**File:** `src/app/api/b2b/pim/sources/[source_id]/trigger/route.ts`

This endpoint:
1. Validates the source exists and has API config
2. Creates an import job in MongoDB
3. Adds the job to BullMQ queue
4. Returns job ID for monitoring

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Import Flow                             │
└─────────────────────────────────────────────────────────────┘

1. Trigger Import
   └─> POST /api/b2b/pim/sources/api-supplier-1/trigger
       │
       ├─> Creates ImportJob document
       │   {
       │     job_id: "api-import-api-supplier-1-123456",
       │     status: "pending",
       │     total_rows: 0,
       │     ...
       │   }
       │
       └─> Adds to BullMQ Queue
           {
             api_config: { endpoint, method, headers },
             field_mappings: { "oarti": "entity_code", ... },
             auto_publish_enabled: true
           }

2. Worker Processes Job (pnpm worker:pim)
   │
   ├─> Fetches data from API endpoint
   │   GET https://api.example.com/products
   │
   ├─> Transforms using field_mappings
   │   "oarti" → "entity_code"
   │   "carti" → "sku"
   │
   ├─> Creates/Updates PIM products
   │   - Calculates completeness score
   │   - Auto-publishes if score >= min_score_threshold
   │
   └─> Updates job status
       status: "completed"
       successful_rows: 150
       auto_published_count: 120

3. Results
   │
   ├─> Import job record in DB
   ├─> Products in pim_products collection
   └─> Updated source stats
       {
         total_imports: 1,
         total_products: 150,
         last_import_status: "success"
       }
```

## Setup Instructions

### Step 1: Configure Your API Endpoint

Edit `scripts/add-api-config-and-trigger-import.cjs`:

```javascript
const TEST_API_CONFIG = {
  endpoint: "https://your-api.com/products",  // ← Change this
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN"      // ← Add if needed
  },
  auth_type: "bearer",                        // ← Change if needed
  auth_token: "YOUR_API_TOKEN",               // ← Add if needed
  schedule_cron: "0 */6 * * *"               // Every 6 hours
};
```

Run the script:
```bash
node scripts/add-api-config-and-trigger-import.cjs
```

### Step 2: Update Field Mappings

Your field mappings transform API response fields to PIM schema:

```typescript
// Current mappings for api-supplier-1:
{
  "oarti": "entity_code",  // API field → PIM field
  "carti": "sku"
}
```

Update via the UI or directly in MongoDB to match your API response structure.

### Step 3: Start the Worker

The worker processes import jobs from the queue:

```bash
# Terminal 1: Start Next.js server
pnpm dev

# Terminal 2: Start the worker
pnpm worker:pim
```

You should see:
```
🔌 Connecting to Redis...
✅ Connected to Redis
🎯 Worker started for queue: product-import
📊 Listening for jobs...
```

### Step 4: Trigger an Import

#### Option A: Using the Script

```bash
./scripts/trigger-test-import.sh
```

#### Option B: Using curl

```bash
curl -X POST http://localhost:3000/api/b2b/pim/sources/api-supplier-1/trigger
```

#### Option C: Via UI

Visit your import sources page and click "Trigger Import" button (if implemented).

### Step 5: Monitor Progress

**Bull Board Dashboard:**
```
http://localhost:3000/api/admin/bull-board
```

Here you can see:
- Active jobs
- Completed jobs
- Failed jobs
- Job details and logs
- Retry failed jobs

**Check Job Status:**
```bash
node -e "
require('dotenv').config({path: '.env.local'});
const {MongoClient} = require('mongodb');

(async()=>{
  const client = await MongoClient.connect(process.env.VINC_MONGO_URL);
  const db = client.db('hdr-api-it');

  const jobs = await db.collection('import_jobs')
    .find()
    .sort({created_at: -1})
    .limit(5)
    .toArray();

  console.log('Recent Import Jobs:');
  jobs.forEach(job => {
    console.log('');
    console.log('Job ID:', job.job_id);
    console.log('Status:', job.status);
    console.log('Progress:', job.processed_rows + '/' + job.total_rows);
    console.log('Success:', job.successful_rows);
    console.log('Failed:', job.failed_rows);
  });

  await client.close();
})().catch(console.error);
"
```

**Check Imported Products:**
```bash
node -e "
require('dotenv').config({path: '.env.local'});
const {MongoClient} = require('mongodb');

(async()=>{
  const client = await MongoClient.connect(process.env.VINC_MONGO_URL);
  const db = client.db('hdr-api-it');

  const count = await db.collection('pim_products').countDocuments({
    'import_metadata.source_id': 'api-supplier-1'
  });

  console.log('Products from api-supplier-1:', count);

  await client.close();
})().catch(console.error);
"
```

## Troubleshooting

### No Jobs Created

**Problem:** Triggering import returns success but no job appears

**Solutions:**
1. Check Next.js server is running: `pnpm dev`
2. Check MongoDB connection in `.env.local`
3. Check API response in browser DevTools

### Worker Not Processing Jobs

**Problem:** Jobs stay in "pending" status

**Solutions:**
1. Make sure worker is running: `pnpm worker:pim`
2. Check Redis connection (BullMQ requires Redis)
3. Check worker logs for errors

### Import Fails

**Problem:** Job status shows "failed"

**Solutions:**
1. Check API endpoint is accessible
2. Verify authentication headers
3. Check field mappings match API response
4. View error details in Bull Board

### No Products After Successful Import

**Problem:** Job succeeds but `total_products: 0`

**Solutions:**
1. Check API response contains data
2. Verify field mappings are correct
3. Check required fields are being mapped
4. Review worker logs for transformation errors

## Testing with Mock API

For testing without a real API:

### Option 1: JSONPlaceholder

```javascript
const TEST_API_CONFIG = {
  endpoint: "https://jsonplaceholder.typicode.com/posts",
  method: "GET",
  auth_type: "none"
};

// Field mappings for posts API:
{
  "id": "entity_code",
  "title": "name",
  "body": "description"
}
```

### Option 2: Create Mock Data Script

Create `scripts/create-mock-products.cjs`:

```javascript
// Returns array of mock products matching your schema
const mockProducts = Array.from({ length: 100 }, (_, i) => ({
  oarti: `PROD-${i + 1}`,
  carti: `SKU-${i + 1}`,
  // ... rest of fields
}));

// Start local server serving this data
// Point API endpoint to http://localhost:3001/products
```

## Current Status

✅ **Model Updated:** Import source now supports API config
✅ **API Config Added:** `api-supplier-1` configured
✅ **Trigger Endpoint:** Ready to receive import requests
✅ **Field Mappings:** 17 mappings configured

❌ **Worker:** Not running - start with `pnpm worker:pim`
❌ **Jobs:** None created - trigger with script or API
❌ **Products:** None imported - run import first

## Next Steps

1. ✅ Configure your actual API endpoint
2. ✅ Update field mappings to match API response
3. ✅ Start the worker: `pnpm worker:pim`
4. ✅ Trigger import: `./scripts/trigger-test-import.sh`
5. ✅ Monitor at: http://localhost:3000/api/admin/bull-board
6. ✅ View products at: http://localhost:3000/b2b/pim/products

## Files Created/Modified

**Modified:**
- `src/lib/db/models/import-source.ts` - Added api_config field
- MongoDB: `import_sources.api-supplier-1` - Added API configuration

**Created:**
- `src/app/api/b2b/pim/sources/[source_id]/trigger/route.ts` - Trigger endpoint
- `scripts/add-api-config-and-trigger-import.cjs` - Setup script
- `scripts/trigger-test-import.sh` - Test trigger script
- `API_IMPORT_SETUP.md` - This guide
