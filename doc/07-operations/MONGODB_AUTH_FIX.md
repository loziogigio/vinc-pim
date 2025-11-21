# MongoDB Authentication Fix for PIM Worker

## Problem

The PIM worker keeps failing with `MongoServerError: Authentication failed` even after fixing environment variables. This is due to Mongoose caching connections globally.

## Root Cause

1. Mongoose caches connections in `global._mongoose`
2. When the worker first starts with bad credentials, it caches that connection
3. Even after restarting with correct credentials, Mongoose reuses the cached bad connection
4. Scripts work because they're fresh processes, but worker fails because it tries to reuse cached connection

## Quick Solution: Use Local MongoDB Without Auth

For development, the easiest fix is to use MongoDB without authentication:

### Option 1: Update .env to use local MongoDB (NO AUTH)

```bash
# .env
VINC_MONGO_URL=mongodb://localhost:27017
VINC_MONGO_DB=vinc-pim-dev
```

### Option 2: Keep Current Setup but Clear Mongoose Cache

Add this to `workers/pim-import.ts` BEFORE importing any models:

```typescript
// Clear any cached Mongoose connections
if (global._mongoose) {
  if (global._mongoose.conn) {
    await global._mongoose.conn.close();
  }
  global._mongoose = { conn: null, promise: null };
}
```

### Option 3: Use Separate MongoDB Connection for Worker

Create a new connection file specifically for the worker that doesn't use global cache.

## Recommended Fix (Simplest)

**Use local MongoDB without authentication for development:**

1. **Stop worker** (`Ctrl+C`)

2. **Update `.env`:**
   ```bash
   VINC_MONGO_URL=mongodb://localhost:27017
   VINC_MONGO_DB=vinc-pim-dev
   ```

3. **Restart MongoDB** without auth:
   ```bash
   docker stop mongodb
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

4. **Restart worker:**
   ```bash
   pnpm worker:pim
   ```

5. **Test import** - should work immediately

## Production Setup

For production, use proper MongoDB with authentication:
- Store credentials in secrets manager
- Use MongoDB Atlas (handles auth automatically)
- Use connection pooling properly
- Set up replica sets for high availability

## Files Modified

If using Option 2 (clear cache), modify:
- `workers/pim-import.ts` - Add cache clear at startup
- `src/lib/db/connection.ts` - Add force reconnect option

## Testing

After applying fix:

1. Worker should start without errors
2. Upload CSV file
3. Worker should process without MongoDB auth errors
4. Jobs should complete successfully

## Current Status

- ❌ Worker failing with MongoDB auth errors
- ✅ Scripts (cleanup, etc.) work fine
- ❌ Mongoose caching bad connection
- ⏳ Need to apply one of the fixes above
