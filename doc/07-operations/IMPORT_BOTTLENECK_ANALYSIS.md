# Import System Bottleneck Analysis

## Current Problem: Handling Large Batch Sizes

**Scenario:** An API source configured to send 1,000 items instead sends 100,000 items

---

## 🚨 Critical Issues in Current Implementation

### 1. **No Batch Size Validation**

**Location:** `src/lib/queue/import-worker.ts` (Lines 103-130)

```typescript
// ❌ PROBLEM: Loads ALL data into memory at once
const apiData = await response.json();
const dataArray = Array.isArray(apiData) ? apiData : [apiData];

rows = dataArray.map((item: any) => {
  // Transform all items at once
});

console.log(`✅ Transformed ${rows.length} items from API`);
```

**Issue:**
- 100K items × ~2KB per item = **200MB JSON in memory**
- No validation if batch exceeds expected size
- No warning or rejection for oversized batches

---

### 2. **Sequential Processing Without Chunking**

**Location:** `src/lib/queue/import-worker.ts` (Line 177)

```typescript
// ❌ PROBLEM: Processes ALL rows sequentially, one by one
for (const row of rows) {
  try {
    // 1. findOne query - checks existing product
    const latestProduct = await PIMProductModel.findOne({
      wholesaler_id,
      entity_code,
      isCurrent: true,
    }).sort({ version: -1 });

    // 2. updateMany query - marks old versions as not current
    if (latestProduct) {
      await PIMProductModel.updateMany(
        { wholesaler_id, entity_code, isCurrent: true },
        { isCurrent: false, isCurrentPublished: false }
      );
    }

    // 3. create query - inserts new version
    await PIMProductModel.create({
      wholesaler_id,
      entity_code,
      // ... product data
    });

    processed++;
  } catch (error) {
    // Error handling
  }
}
```

**Performance Impact for 100K items:**
- **300,000 database queries** (3 queries per item)
- **Estimated time:** 100,000 items × 50ms/item = **~83 minutes**
- **Database connections:** Could exhaust connection pool
- **Memory:** All 100K items held in memory during entire process

---

### 3. **No Rate Limiting or Throttling**

**Location:** `src/lib/queue/queues.ts`

```typescript
// ❌ PROBLEM: No concurrency limits
export const importQueue = new Queue("import-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    // ❌ NO RATE LIMITS
    // ❌ NO CONCURRENCY LIMITS
    // ❌ NO JOB SIZE LIMITS
  },
});
```

**Issue:**
- Multiple large jobs can run simultaneously
- No limit on concurrent database operations
- No memory usage monitoring

---

### 4. **File Import Same Issue**

**Location:** `src/lib/queue/import-worker.ts` (Lines 142-153)

```typescript
// ❌ PROBLEM: Loads entire file into memory
const response = await fetch(file_url);
const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

// ❌ Then parses entire file at once
if (fileType === "excel") {
  rows = await parseExcel(buffer, source); // All rows in memory
} else if (fileType === "csv") {
  rows = await parseCSV(buffer, source); // All rows in memory
}
```

**Issue:**
- 100K row CSV file = **~50-100MB in memory**
- No streaming parser
- No row-by-row processing

---

## 💥 What Happens with 100K Items?

### Memory Impact
```
API Response JSON:    200 MB
Parsed rows array:    150 MB
Active DB connections: 50 MB
Node.js heap:         ~400 MB total

Risk: Out of Memory (OOM) crash if heap limit exceeded
```

### Database Impact
```
Queries per item:      3 (findOne + updateMany + create)
Total queries:         300,000
Avg query time:        50ms
Total time:            ~83 minutes
Connection pool size:  10-20 connections

Risk: Connection pool exhaustion, slow queries, database overload
```

### Worker Impact
```
BullMQ default timeout: 30 minutes (configurable)
Actual processing time: 83 minutes

Risk: Job timeout, partial imports, data inconsistency
```

---

## ✅ Solutions & Best Practices

### Solution 1: **Batch Size Validation**

Add validation before processing:

```typescript
// src/lib/queue/import-worker.ts

const MAX_BATCH_SIZE = 10000; // Configure per source
const WARN_BATCH_SIZE = 5000;

// After fetching API data
const dataArray = Array.isArray(apiData) ? apiData : [apiData];

if (dataArray.length > MAX_BATCH_SIZE) {
  throw new Error(
    `Batch size ${dataArray.length} exceeds maximum allowed ${MAX_BATCH_SIZE}. ` +
    `Please split into smaller batches or increase limit for this source.`
  );
}

if (dataArray.length > WARN_BATCH_SIZE) {
  console.warn(`⚠️ Large batch detected: ${dataArray.length} items (threshold: ${WARN_BATCH_SIZE})`);
  // Log to monitoring system, send alert, etc.
}
```

**Benefits:**
- Prevents oversized batches from crashing system
- Provides clear error message to API provider
- Configurable per import source

---

### Solution 2: **Chunked Processing with Progress Updates**

Process in chunks instead of all at once:

```typescript
// src/lib/queue/import-worker.ts

const CHUNK_SIZE = 100; // Process 100 items at a time

// Split rows into chunks
for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const chunk = rows.slice(i, i + CHUNK_SIZE);

  console.log(`📦 Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(rows.length / CHUNK_SIZE)}`);

  // Process chunk
  for (const row of chunk) {
    // ... existing processing logic
  }

  // Update job progress after each chunk
  await ImportJobModel.findOneAndUpdate(
    { job_id },
    {
      processed_rows: i + chunk.length,
      updated_at: new Date()
    }
  );

  // Allow event loop to breathe
  await new Promise(resolve => setImmediate(resolve));
}
```

**Benefits:**
- **Progress visibility**: Users see real-time progress
- **Memory control**: Only ~100 items in active processing
- **Interruptible**: Can pause/cancel between chunks
- **Event loop friendly**: Doesn't block Node.js event loop

**Performance:** 100K items = 1,000 chunks × 5s/chunk = **~83 minutes** (same time, better UX)

---

### Solution 3: **Bulk Database Operations**

Use MongoDB bulk operations instead of individual queries:

```typescript
// src/lib/queue/import-worker.ts

const CHUNK_SIZE = 100;

for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const chunk = rows.slice(i, i + CHUNK_SIZE);
  const bulkOps = [];

  for (const row of chunk) {
    const { entity_code, data } = row;

    // Prepare bulk operation
    bulkOps.push({
      updateOne: {
        filter: { wholesaler_id, entity_code, isCurrent: true },
        update: {
          $set: {
            ...data,
            updated_at: new Date(),
            isCurrent: true,
            isCurrentPublished: data.status === 'published'
          },
          $inc: { version: 1 }  // Atomic version increment
        },
        upsert: true
      }
    });
  }

  // Execute bulk operation (1 query instead of 300)
  // ordered: false means one failure doesn't stop other operations
  if (bulkOps.length > 0) {
    try {
      const result = await PIMProductModel.bulkWrite(bulkOps, { ordered: false });

      console.log(`✅ Chunk processed: ${result.insertedCount + result.modifiedCount}/${bulkOps.length} succeeded`);

      successful += result.insertedCount + result.modifiedCount;

    } catch (error: any) {
      // With ordered: false, we get partial success even if some operations fail
      if (error.writeErrors) {
        console.error(`⚠️ Bulk write had ${error.writeErrors.length} errors out of ${bulkOps.length} operations`);

        // Log individual failures
        error.writeErrors.forEach((writeError: any) => {
          const failedRow = chunk[writeError.index];
          errors.push({
            row: i + writeError.index + 1,
            entity_code: failedRow.entity_code,
            error: writeError.errmsg,
            raw_data: failedRow.data,
          });
          failed++;
        });

        // Count successful operations (even though some failed)
        const successfulInBulk = bulkOps.length - error.writeErrors.length;
        successful += successfulInBulk;

        console.log(`✅ ${successfulInBulk} operations succeeded despite errors`);
      } else {
        // Complete bulk operation failure (rare)
        console.error('❌ Complete bulk write failure:', error.message);

        // Mark entire chunk as failed
        chunk.forEach((row, idx) => {
          errors.push({
            row: i + idx + 1,
            entity_code: row.entity_code,
            error: error.message,
            raw_data: row.data,
          });
          failed++;
        });
      }
    }
  }

  processed += chunk.length;

  // Update job progress after each chunk
  await ImportJobModel.findOneAndUpdate(
    { job_id },
    {
      processed_rows: processed,
      successful_rows: successful,
      failed_rows: failed,
      import_errors: errors,
      updated_at: new Date()
    }
  );
}
```

---

#### **Understanding `ordered: false`**

**Critical behavior difference:**

| Parameter | Behavior | Example Result |
|-----------|----------|----------------|
| `ordered: true` | Stops at first error | Item 1-3 ✅, Item 4 ❌ → Items 5-100 ⚠️ NOT EXECUTED |
| `ordered: false` | Continues on error | Item 1-3 ✅, Item 4 ❌, Items 5-99 ✅, Item 42 ❌ → 98 succeeded |

**Why `ordered: false` is better for imports:**

1. ✅ **One bad item doesn't fail entire chunk**
   - With `ordered: true`: 4 failures → only 42 items imported
   - With `ordered: false`: 4 failures → 96 items imported

2. ✅ **Better performance** (parallel execution)
3. ✅ **Complete error report** (see ALL failures, not just first)
4. ✅ **Better user experience** (import as much as possible)

**Example scenario:**
```
Chunk has 100 items:
- Item #4: Missing required field (validation error)
- Item #42: Duplicate key error
- Item #83: Invalid data type

With ordered: false:
✅ 97 items successfully imported
❌ 3 items failed with detailed error logs
⏱️ Takes ~100ms for entire chunk

With ordered: true:
✅ 3 items imported (stopped at item #4)
❌ 1 item failed
⚠️ 96 items not attempted
⏱️ Takes ~50ms but 96% data loss
```

---

**Benefits:**
- **300 queries → 1 query** per chunk
- **50x faster** database operations
- **Reduced connection usage**
- **Resilient to individual item failures** (key benefit!)

**Performance:** 100K items = 1,000 chunks × 0.1s/chunk = **~2 minutes**

---

### Solution 4: **Rate Limiting & Concurrency Control**

Configure BullMQ worker with limits:

```typescript
// src/lib/queue/import-worker.ts or worker startup file

import { Worker } from "bullmq";

const importWorker = new Worker(
  "import-queue",
  async (job) => {
    await processImport(job);
  },
  {
    connection,
    concurrency: 2, // ✅ Only 2 imports at a time
    limiter: {
      max: 5, // ✅ Max 5 jobs per duration
      duration: 60000, // ✅ Per 60 seconds
    },
    settings: {
      maxStalledCount: 1, // Retry once if stalled
      stalledInterval: 300000, // 5 minutes
    },
  }
);
```

**Benefits:**
- Prevents worker overload
- Limits concurrent database operations
- Configurable based on server capacity

---

### Solution 5: **Job Size Limits & Source Configuration**

Add configuration to import sources:

```typescript
// src/lib/db/models/import-source.ts

const ImportSourceSchema = new Schema({
  // ... existing fields

  limits: {
    max_batch_size: { type: Number, default: 10000 },
    warn_batch_size: { type: Number, default: 5000 },
    chunk_size: { type: Number, default: 100 },
    timeout_minutes: { type: Number, default: 60 },
  },

  // ... rest of schema
});
```

**Benefits:**
- Per-source configuration
- Flexible limits based on data source
- Easy to adjust without code changes

---

### Solution 6: **Streaming for Large Files**

For CSV/Excel files, use streaming parsers:

```typescript
// Use streaming CSV parser
import { parse } from 'csv-parse';
import { Readable } from 'stream';

async function* streamCSV(buffer: Buffer) {
  const stream = Readable.from(buffer);
  const parser = stream.pipe(parse({ columns: true }));

  for await (const row of parser) {
    yield row;
  }
}

// Process in chunks while streaming
const chunk = [];
for await (const row of streamCSV(buffer)) {
  chunk.push(row);

  if (chunk.length >= CHUNK_SIZE) {
    await processChunk(chunk);
    chunk.length = 0; // Clear chunk
  }
}

// Process remaining
if (chunk.length > 0) {
  await processChunk(chunk);
}
```

**Benefits:**
- **Constant memory usage** regardless of file size
- Can process files larger than available RAM
- Better for 100K+ row files

---

## 📊 Performance Comparison

| Approach | Time (100K items) | Memory | DB Queries | Risk |
|----------|-------------------|---------|------------|------|
| **Current (no chunking)** | ~83 min | 400 MB | 300,000 | 🔴 HIGH |
| **Chunked (current logic)** | ~83 min | 150 MB | 300,000 | 🟡 MEDIUM |
| **Chunked + Bulk Ops** | ~2 min | 150 MB | 1,000 | 🟢 LOW |
| **Streaming + Bulk Ops** | ~2 min | 50 MB | 1,000 | 🟢 LOW |

---

## 🎯 Recommended Implementation Priority

### Phase 1: Immediate Protection (Today)
1. ✅ Add batch size validation (MAX_BATCH_SIZE)
2. ✅ Add warning logs for large batches
3. ✅ Configure worker concurrency limits

**Effort:** 30 minutes
**Impact:** Prevents crashes and provides visibility

### Phase 2: Performance Optimization (This Week)
1. ✅ Implement chunked processing
2. ✅ Add progress updates per chunk
3. ✅ Use bulk database operations

**Effort:** 4-6 hours
**Impact:** 40x faster, better UX, lower memory

### Phase 3: Scalability (Next Sprint)
1. ✅ Implement streaming parsers for large files
2. ✅ Add per-source limit configuration
3. ✅ Add monitoring and alerting

**Effort:** 8-12 hours
**Impact:** Handle any size import, full observability

---

## 🔗 Batch Tracking & Split Management

### Problem: How to Track Split Batches

**Scenario:** User splits 100K items into 10 batches of 10K items each. How do we know they're related?

**Challenges:**
1. Which imports belong to the same logical batch?
2. How to prevent duplicates if they re-run the same batch?
3. How to track progress across multiple split imports?
4. How to report on the complete batch?

---

### Solution: Multi-Level Batch Tracking

#### 1. **Batch ID from API Provider** (Recommended)

The API provider should send a `batch_id` in their payload:

```json
{
  "batch_id": "2025-11-01-supplier-abc-full-catalog",
  "batch_part": 1,
  "batch_total_parts": 10,
  "batch_total_items": 100000,
  "items": [
    { "id": "001", "name": "Product 1", ... },
    { "id": "002", "name": "Product 2", ... }
  ]
}
```

**Import Worker Update:**

```typescript
// src/lib/queue/import-worker.ts

interface ImportJobData {
  // ... existing fields
  batch_metadata?: {
    batch_id: string;          // Unique ID for the entire batch
    batch_part: number;        // Which part is this (1-based)
    batch_total_parts: number; // Total expected parts
    batch_total_items: number; // Total items across all parts
  };
}

// After fetching API data
const batchMetadata = job.data.batch_metadata;

if (batchMetadata) {
  console.log(`📦 Batch ${batchMetadata.batch_id} - Part ${batchMetadata.batch_part}/${batchMetadata.batch_total_parts}`);

  // Validate part number
  if (batchMetadata.batch_part > batchMetadata.batch_total_parts) {
    throw new Error(`Invalid batch part: ${batchMetadata.batch_part} exceeds total ${batchMetadata.batch_total_parts}`);
  }
}

// Store in import job
await ImportJobModel.findOneAndUpdate(
  { job_id },
  {
    batch_id: batchMetadata?.batch_id,
    batch_part: batchMetadata?.batch_part,
    batch_total_parts: batchMetadata?.batch_total_parts,
    batch_total_items: batchMetadata?.batch_total_items,
  }
);
```

#### 2. **Database Schema Updates**

Add batch tracking fields to ImportJob model:

```typescript
// src/lib/db/models/import-job.ts

export interface IImportJob extends Document {
  // ... existing fields

  // Batch tracking
  batch_id?: string;          // Links multiple imports together
  batch_part?: number;        // Which part of the batch (1, 2, 3...)
  batch_total_parts?: number; // Total expected parts
  batch_total_items?: number; // Total items across all parts
  parent_job_id?: string;     // If this is a retry of another job
}

const ImportJobSchema = new Schema<IImportJob>({
  // ... existing fields

  batch_id: { type: String, index: true },
  batch_part: { type: Number },
  batch_total_parts: { type: Number },
  batch_total_items: { type: Number },
  parent_job_id: { type: String, index: true },
});

// Add compound index for batch queries
ImportJobSchema.index({ batch_id: 1, batch_part: 1 });
```

#### 3. **Batch Progress Tracking**

Query to see all parts of a batch:

```typescript
// Get all jobs for a batch
const batchJobs = await ImportJobModel.find({
  batch_id: "2025-11-01-supplier-abc-full-catalog"
}).sort({ batch_part: 1 });

// Calculate batch progress
const batchProgress = {
  batch_id: batchJobs[0].batch_id,
  total_parts: batchJobs[0].batch_total_parts,
  completed_parts: batchJobs.filter(j => j.status === 'completed').length,
  failed_parts: batchJobs.filter(j => j.status === 'failed').length,
  total_items_processed: batchJobs.reduce((sum, j) => sum + j.successful_rows, 0),
  total_items_failed: batchJobs.reduce((sum, j) => sum + j.failed_rows, 0),
  is_complete: batchJobs.every(j => j.status === 'completed' || j.status === 'failed'),
};

console.log(`Batch Progress: ${batchProgress.completed_parts}/${batchProgress.total_parts} parts complete`);
```

#### 4. **Deduplication Strategy**

Use `entity_code` to prevent duplicates across batch parts:

```typescript
// Current implementation already handles this via upsert
await PIMProductModel.updateOne(
  {
    wholesaler_id,
    entity_code,  // ✅ This prevents duplicates
    isCurrent: true
  },
  { $set: { ...productData } },
  { upsert: true }
);
```

**Key Points:**
- ✅ `entity_code` is the natural deduplication key
- ✅ If same item appears in Part 1 and Part 2, Part 2 overwrites Part 1
- ✅ Last import wins (newest data)
- ⚠️ If `entity_code` changes between parts, creates duplicate products

#### 5. **Time-Based Batch Grouping** (Fallback)

If API provider doesn't send `batch_id`, group by source + time:

```typescript
// Auto-generate batch_id based on source and time window
const batchId = `${source_id}-${new Date().toISOString().split('T')[0]}-${Date.now()}`;

// Or use a time window (e.g., all imports within 1 hour)
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

const recentJobs = await ImportJobModel.find({
  source_id,
  wholesaler_id,
  created_at: { $gte: oneHourAgo },
  batch_id: { $exists: false } // Only jobs without explicit batch_id
}).sort({ created_at: 1 });

// Group as implicit batch
const implicitBatchId = `auto-${source_id}-${recentJobs[0]._id}`;
```

---

### UI: Batch View in Jobs Page

**Show grouped batches:**

```typescript
// src/app/b2b/(protected)/pim/jobs/page.tsx

// Fetch jobs grouped by batch
const batchGroups = await ImportJobModel.aggregate([
  { $match: { wholesaler_id, batch_id: { $exists: true } } },
  {
    $group: {
      _id: "$batch_id",
      jobs: { $push: "$$ROOT" },
      total_parts: { $first: "$batch_total_parts" },
      completed_count: {
        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
      },
      total_successful: { $sum: "$successful_rows" },
      total_failed: { $sum: "$failed_rows" },
      latest_update: { $max: "$updated_at" }
    }
  },
  { $sort: { latest_update: -1 } }
]);

// Display as expandable batch groups
{batchGroups.map(batch => (
  <div key={batch._id} className="border rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold">Batch: {batch._id}</h3>
        <p className="text-sm text-muted-foreground">
          {batch.completed_count}/{batch.total_parts} parts complete
        </p>
      </div>
      <div className="text-right">
        <div className="text-green-600 font-medium">
          {batch.total_successful.toLocaleString()} successful
        </div>
        {batch.total_failed > 0 && (
          <div className="text-red-600">
            {batch.total_failed.toLocaleString()} failed
          </div>
        )}
      </div>
    </div>

    {/* Expandable: Show individual jobs */}
    <details className="mt-2">
      <summary className="cursor-pointer text-sm text-blue-600">
        View {batch.jobs.length} individual imports
      </summary>
      <div className="mt-2 space-y-1">
        {batch.jobs.map(job => (
          <div key={job.job_id} className="text-sm pl-4 border-l-2">
            Part {job.batch_part}: {job.successful_rows} items - {job.status}
          </div>
        ))}
      </div>
    </details>
  </div>
))}
```

---

### API Provider Guidelines

**Recommended payload format for split batches:**

```json
{
  "batch_id": "unique-batch-identifier",
  "batch_part": 1,
  "batch_total_parts": 10,
  "batch_total_items": 100000,
  "timestamp": "2025-11-01T10:30:00Z",
  "items": [
    {
      "entity_code": "PROD-001",
      "name": "Product 1",
      "sku": "SKU-001",
      ...
    }
  ]
}
```

**Best practices:**
1. ✅ Use consistent `batch_id` across all parts
2. ✅ Send sequential `batch_part` numbers (1, 2, 3...)
3. ✅ Include `batch_total_parts` in every part
4. ✅ Use unique `entity_code` for deduplication
5. ✅ Send parts in order (not required, but helpful)
6. ✅ Include timestamp for time-based grouping

---

### Error Handling for Partial Batch Failures

```typescript
// Check if batch is complete
async function checkBatchCompletion(batch_id: string) {
  const jobs = await ImportJobModel.find({ batch_id }).sort({ batch_part: 1 });

  const expectedParts = jobs[0]?.batch_total_parts || 0;
  const receivedParts = jobs.length;

  if (receivedParts < expectedParts) {
    console.warn(`⚠️ Incomplete batch ${batch_id}: ${receivedParts}/${expectedParts} parts received`);
    return {
      status: 'incomplete',
      missing_parts: Array.from({ length: expectedParts }, (_, i) => i + 1)
        .filter(part => !jobs.find(j => j.batch_part === part))
    };
  }

  const allCompleted = jobs.every(j => j.status === 'completed' || j.status === 'failed');
  const anyFailed = jobs.some(j => j.status === 'failed');

  return {
    status: allCompleted ? (anyFailed ? 'partial_success' : 'complete') : 'in_progress',
    jobs,
    total_successful: jobs.reduce((sum, j) => sum + j.successful_rows, 0),
    total_failed: jobs.reduce((sum, j) => sum + j.failed_rows, 0),
  };
}
```

---

## 🔧 Monitoring & Alerts

### Metrics to Track

```typescript
// Add monitoring in import worker
const metrics = {
  job_id,
  batch_size: rows.length,
  chunk_count: Math.ceil(rows.length / CHUNK_SIZE),
  start_time: Date.now(),
  memory_start: process.memoryUsage().heapUsed,

  // Track per chunk
  chunks_processed: 0,
  current_memory: 0,
  estimated_time_remaining: 0,
};

// Log progress
console.log(JSON.stringify({
  event: 'import_chunk_complete',
  ...metrics,
  progress_percent: (metrics.chunks_processed / metrics.chunk_count) * 100
}));
```

### Alert Conditions

1. **Batch size exceeds threshold**
   - Alert: Email/Slack to admin
   - Action: Review API source configuration

2. **Job duration exceeds 30 minutes**
   - Alert: Warning log
   - Action: Consider increasing chunk size or worker concurrency

3. **Memory usage > 80% of heap**
   - Alert: Critical log
   - Action: Reduce chunk size or concurrent jobs

4. **Error rate > 10%**
   - Alert: Email/Slack
   - Action: Review data quality or field mappings

---

## 📝 Configuration Example

```typescript
// .env or config file

# Import Worker Configuration
IMPORT_MAX_BATCH_SIZE=10000
IMPORT_WARN_BATCH_SIZE=5000
IMPORT_CHUNK_SIZE=100
IMPORT_WORKER_CONCURRENCY=2
IMPORT_JOB_TIMEOUT_MINUTES=60

# Rate Limiting
IMPORT_RATE_LIMIT_MAX=5
IMPORT_RATE_LIMIT_DURATION_MS=60000

# Database Bulk Operations
IMPORT_BULK_OP_SIZE=100
```

---

## 🚀 Next Steps

1. Review this document with team
2. Prioritize Phase 1 implementation (batch validation)
3. Create tickets for Phase 2 and Phase 3
4. Set up monitoring dashboard for import metrics

**Questions to discuss:**
- What should MAX_BATCH_SIZE be for different sources?
- Should we automatically split large batches or reject them?
- Do we need different chunk sizes for different data types?
- Should we add a "test mode" with smaller limits?

---

**Document created:** 2025-11-01
**Last updated:** 2025-11-01
**Status:** Analysis complete, awaiting implementation
