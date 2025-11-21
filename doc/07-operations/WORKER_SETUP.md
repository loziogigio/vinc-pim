# BullMQ Worker Setup

This document explains how to set up and run the PIM Import Worker for background job processing.

## Overview

The PIM system uses **BullMQ** for background job processing, which requires:
- **Redis** server for job queue management
- **Worker process** running separately from Next.js dev server
- **Environment configuration** for Redis connection

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Next.js App   │         │   Redis Queue   │         │  Worker Process │
│   (Web UI)      │────────▶│   (BullMQ)      │────────▶│  (Background)   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
     │ Add import job              │ Store job data             │ Process job
     │                              │                             │
     ▼                              ▼                             ▼
  User uploads file        Job queued in Redis          Parse file, transform,
  via /admin/pim/import    waiting for worker           save to PIMProduct
```

## Prerequisites

### 1. Redis Server

**Verify Redis is Running:**
```bash
docker ps | grep redis
```

Expected output:
```
CONTAINER ID   IMAGE          COMMAND                  PORTS
abc123def456   redis:alpine   "docker-entrypoint.s…"   0.0.0.0:6379->6379/tcp
```

**Start Redis (if not running):**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

**Test Redis Connection:**
```bash
redis-cli ping
# Should return: PONG
```

### 2. Environment Configuration

Redis configuration is in `.env`:

```bash
# Redis connection (for BullMQ background jobs)
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Note:** The worker loads both `.env` and `.env.local` files. Local overrides can be placed in `.env.local`.

## Running the Worker

### Development Mode

**Start the worker in a separate terminal:**
```bash
cd /home/jire87/software/www-website/www-data/vendereincloud-app/vinc-apps/vinc-storefront
pnpm worker:pim
```

**Expected Output:**
```
🚀 PIM Import Worker starting...
📍 Redis: localhost:6379
📊 Concurrency: 2 jobs

✅ Worker ready and listening for jobs
   Press Ctrl+C to stop
```

**Keep this terminal running** - the worker must stay active to process import jobs.

### Running Multiple Processes

For development, you need **two separate terminals**:

**Terminal 1 - Next.js Dev Server:**
```bash
pnpm dev
```

**Terminal 2 - Worker Process:**
```bash
pnpm worker:pim
```

### Stopping the Worker

**Graceful Shutdown:**
- Press `Ctrl+C` in the worker terminal
- The worker will finish current jobs before exiting

## Testing the Worker

### 1. Start All Services

```bash
# Terminal 1: Start Next.js
pnpm dev

# Terminal 2: Start Worker
pnpm worker:pim
```

### 2. Upload a Test File

1. Navigate to: http://localhost:3001/admin/pim/import
2. Select an import source
3. Upload a CSV or Excel file
4. Click "Start Import"

### 3. Monitor Progress

**Check Worker Terminal:**
- You should see log messages as the job is processed
- Example: `Processing import job: job_abc123`

**Check Jobs Page:**
- Navigate to: http://localhost:3001/admin/pim/jobs
- View real-time job progress
- Check for any errors

### 4. Verify Results

**Check Products Page:**
- Navigate to: http://localhost:3001/admin/pim/products
- Imported products should appear
- Quality scores should be calculated

## Production Deployment

### Using PM2 (Recommended)

**Install PM2:**
```bash
npm install -g pm2
```

**Create PM2 Ecosystem File** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [
    {
      name: 'vinc-storefront',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'pim-worker',
      script: 'workers/pim-import.ts',
      interpreter: 'tsx',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      }
    }
  ]
};
```

**Start Services:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Monitor:**
```bash
pm2 status
pm2 logs pim-worker
pm2 monit
```

### Using systemd (Linux)

**Create Service File** (`/etc/systemd/system/pim-worker.service`):
```ini
[Unit]
Description=PIM Import Worker
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/vinc-storefront
ExecStart=/usr/bin/node --loader tsx workers/pim-import.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=REDIS_HOST=localhost
Environment=REDIS_PORT=6379

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**
```bash
sudo systemctl enable pim-worker
sudo systemctl start pim-worker
sudo systemctl status pim-worker
```

### Using Docker Compose

**Add to `docker-compose.yml`:**
```yaml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  web:
    build: .
    ports:
      - "3001:3001"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis

  worker:
    build: .
    command: pnpm worker:pim
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis

volumes:
  redis-data:
```

## Troubleshooting

### Worker Not Starting

**Symptom:** Worker exits immediately or shows connection errors

**Solutions:**

1. **Check Redis is running:**
   ```bash
   docker ps | grep redis
   redis-cli ping
   ```

2. **Verify environment variables:**
   ```bash
   cat .env | grep REDIS
   ```

3. **Check Redis connection from worker:**
   ```bash
   pnpm worker:pim
   # Look for: 📍 Redis: localhost:6379
   ```

### Jobs Not Processing

**Symptom:** Jobs show "pending" status but never complete

**Solutions:**

1. **Verify worker is running:**
   ```bash
   # Should see worker process
   ps aux | grep "workers/pim-import"
   ```

2. **Check worker logs:**
   - Look for error messages in worker terminal
   - Check Redis connection errors

3. **Restart worker:**
   ```bash
   # Ctrl+C to stop
   pnpm worker:pim
   ```

### Redis Connection Refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solutions:**

1. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 --name redis redis:alpine
   ```

2. **Check port conflicts:**
   ```bash
   lsof -i :6379
   ```

3. **Verify Redis host in .env:**
   ```bash
   # For Docker: REDIS_HOST=localhost
   # For remote: REDIS_HOST=redis.example.com
   ```

### Environment Variables Not Loading

**Symptom:** Worker shows `undefined:undefined` for Redis

**Solutions:**

1. **Verify .env file exists:**
   ```bash
   ls -la .env .env.local
   ```

2. **Check worker loads dotenv:**
   - Worker script should have: `import dotenv from 'dotenv';`
   - Should load both `.env.local` and `.env`

3. **Test environment loading:**
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.REDIS_HOST)"
   ```

## Worker Configuration

### Concurrency

The worker processes **2 jobs concurrently** by default. To adjust:

**Edit** `src/lib/queue/import-worker.ts`:
```typescript
export const importWorker = new Worker(
  QUEUE_NAME,
  importJobProcessor,
  {
    connection: redisConnection,
    concurrency: 4, // Change this value
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);
```

### Job Timeouts

Default timeout is **30 minutes** per job. To adjust:

**Edit** `src/lib/queue/import-worker.ts`:
```typescript
const job = await importQueue.add(
  'import-products',
  jobData,
  {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    timeout: 60 * 60 * 1000, // 1 hour
  }
);
```

## Monitoring

### Built-in PIM Jobs Page

The PIM system includes a built-in jobs monitoring page:

**URL:** `http://localhost:3001/admin/pim/jobs`

**Features:**
- Real-time job status updates
- Auto-refresh every 5 seconds
- Progress bars for active jobs
- Error details and logs
- Job statistics (processed, created, updated, failed)
- Filter by status
- Manual retry for failed jobs

**Recommendation:** Use this page for day-to-day monitoring as it's fully integrated with the PIM system.

### Bull Board (Advanced Monitoring)

Bull Board provides advanced queue monitoring capabilities. The setup files are in place at:
- `/src/lib/queue/bull-board.ts` - Bull Board configuration
- `/src/app/api/admin/bull-board/[...path]/route.ts` - API route

**Note:** Bull Board integration with Next.js 15 App Router requires additional configuration. The built-in `/admin/pim/jobs` page provides all essential monitoring features and is recommended for most use cases.

**Features (if configured):**
- Inspect individual job data in detail
- Retry/remove jobs manually
- View queue statistics
- Monitor multiple queues
- Advanced filtering and search

### Worker Logs

**Development:**
- Logs appear directly in the worker terminal
- Use `console.log()` for debugging

**Production (PM2):**
```bash
pm2 logs pim-worker
pm2 logs pim-worker --lines 100
```

**Production (systemd):**
```bash
sudo journalctl -u pim-worker -f
sudo journalctl -u pim-worker --since "1 hour ago"
```

### Redis Queue Inspection

**Using redis-cli:**
```bash
redis-cli
> KEYS *bull:pim-import:*
> LLEN bull:pim-import:waiting
> LLEN bull:pim-import:active
> LLEN bull:pim-import:completed
> LLEN bull:pim-import:failed
```

**Using BullMQ Admin UI:**
```bash
npm install -g bull-board
bull-board --redis redis://localhost:6379
# Open http://localhost:3000
```

## Scripts Reference

All worker-related scripts in `package.json`:

```json
{
  "scripts": {
    "worker:pim": "tsx workers/pim-import.ts",
    "worker:all": "tsx workers/pim-import.ts"
  }
}
```

**Current workers:**
- `worker:pim` - PIM import worker
- `worker:all` - All workers (currently same as pim)

**Future workers** can be added:
- `worker:email` - Email notification worker
- `worker:analytics` - Analytics processing worker
- etc.

## File Structure

```
vinc-apps/vinc-storefront/
├── workers/
│   └── pim-import.ts          # Standalone worker script
├── src/lib/queue/
│   ├── import-worker.ts       # Worker instance and processor
│   ├── import-queue.ts        # Queue instance
│   └── connection.ts          # Redis connection config
├── .env                       # Redis config (committed)
├── .env.local                 # Local overrides (gitignored)
└── package.json               # Worker scripts
```

## Next Steps

1. ✅ Redis server running
2. ✅ Worker script created
3. ✅ Environment configured
4. ✅ Worker tested successfully
5. ⏳ Test complete import flow end-to-end
6. ⏳ Set up production deployment
7. ⏳ Configure monitoring and alerts

## Related Documentation

- [PIM Implementation Plan](./PIM_IMPLEMENTATION_PLAN.md) - Complete PIM architecture
- [README](./README.md) - PIM system overview
- [Structure Standard](./STRUCTURE_STANDARD.md) - Data structure conventions
