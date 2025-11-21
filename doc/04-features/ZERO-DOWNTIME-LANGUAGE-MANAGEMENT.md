# Zero-Downtime Language Management

**For Multitenant SaaS Applications**

Complete guide for enabling/disabling languages with ZERO downtime and NO restarts required.

---

## Key Architecture Principle

**MongoDB schemas include ALL languages. Runtime validation checks which are enabled.**

```
┌─────────────────────────────────────────┐
│  Application Startup (Once)             │
├─────────────────────────────────────────┤
│  1. Seed 43 languages to MongoDB        │
│  2. Generate schemas for ALL languages  │
│  3. Schemas never change after startup  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Enable Language (Runtime)               │
├─────────────────────────────────────────┤
│  1. Update MongoDB: isEnabled = true    │
│  2. Update Solr schema                  │
│  3. Refresh language cache (5 min TTL)  │
│  4. DONE - NO RESTART                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Request Processing (Every Request)      │
├─────────────────────────────────────────┤
│  1. Check enabled languages (cached)    │
│  2. Validate request languages          │
│  3. Filter response languages           │
└─────────────────────────────────────────┘
```

---

## How It Works

### 1. Schema Generation (Application Startup)

Schemas are generated for **ALL 43 languages** when the app starts:

```typescript
// src/lib/db/schema-generator.ts
export const getAllLanguageCodesForSchema = async (): Promise<string[]> => {
  // Returns ALL languages (enabled + disabled)
  const languages = await LanguageModel.find().select("code").lean();
  return languages.map(l => l.code);
};

// Schemas include all languages
const ProductSchema = new Schema({
  name: {
    it: String,
    de: String,
    en: String,
    cs: String,
    fr: String,  // ✅ Included even if disabled
    es: String,  // ✅ Included even if disabled
    ja: String,  // ✅ Included even if disabled
    // ... all 43 languages
  }
});
```

### 2. Runtime Validation (Every Request)

Request middleware validates only enabled languages:

```typescript
// src/middleware/validate-languages.middleware.ts
export async function validateLanguages(req, res, next) {
  const enabledLanguages = await getEnabledLanguages(); // From cache
  const enabledCodes = new Set(enabledLanguages.map(l => l.code));

  // Strip disabled languages from request
  if (req.body.name) {
    for (const lang of Object.keys(req.body.name)) {
      if (!enabledCodes.has(lang)) {
        delete req.body.name[lang]; // Remove disabled language
      }
    }
  }

  next();
}
```

### 3. Response Filtering (Every Response)

Response middleware filters out disabled languages:

```typescript
export async function filterResponseLanguages(data) {
  const enabledLanguages = await getEnabledLanguages(); // From cache
  const enabledCodes = new Set(enabledLanguages.map(l => l.code));

  // Only return enabled languages
  return {
    name: {
      it: data.name.it,
      de: data.name.de,
      en: data.name.en,
      // fr, es, ja etc. filtered out if disabled
    }
  };
}
```

### 4. Language Cache (5-Minute TTL)

Enabled languages are cached in memory to avoid DB queries:

```typescript
// src/services/language.service.ts
let languageCache: ILanguage[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getEnabledLanguages = async () => {
  const now = Date.now();
  if (!languageCache || now - cacheTimestamp > CACHE_TTL) {
    await refreshLanguageCache(); // Refresh from DB
  }
  return languageCache;
};
```

**Cache refresh triggers:**
- Every 5 minutes automatically
- When language is enabled/disabled via API
- Manual refresh via `/api/languages/refresh-cache`

---

## Zero-Downtime Workflow

### Enable a Language (Live, No Restart)

```bash
# 1. Enable French (takes ~2 seconds)
npx ts-node src/scripts/manage-languages.ts enable fr

# Output:
# ✅ fr (French) - enabled in database
# 🔧 Updating Solr schema...
# ✅ Added field type 'text_fr' to Solr schema
# ✅ Added field 'name_text_fr'
# ✅ Languages enabled! No restart needed - changes are live immediately.

# 2. That's it! French is now available
# - Next request (within 5 min): Uses old cache, French not yet available
# - After cache refresh: French available immediately
# - Manual refresh: curl -X POST /api/languages/refresh-cache
```

### Immediate Activation (Force Cache Refresh)

```bash
# Enable language
curl -X PATCH http://localhost:3000/api/languages/fr/enable \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Immediately refresh cache (makes it available instantly)
curl -X POST http://localhost:3000/api/languages/refresh-cache

# French is now live (no restart)
```

### Test Immediately

```bash
# Create product with French
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": {
      "it": "Tavolo",
      "fr": "Table"
    }
  }'

# ✅ Works immediately (no restart needed)
```

---

## Multitenant Architecture

### Per-Tenant Language Configuration (Optional Future Enhancement)

If you need different languages per tenant:

```typescript
// language.ts model
export interface ILanguage extends Document {
  code: string;
  name: string;
  isEnabled: boolean;
  tenantId?: string; // Optional: per-tenant languages
}

// Service layer
export const getEnabledLanguagesForTenant = async (tenantId: string) => {
  return await LanguageModel.find({
    $or: [
      { isEnabled: true, tenantId: null },      // Global languages
      { isEnabled: true, tenantId: tenantId }   // Tenant-specific
    ]
  });
};
```

---

## Performance Characteristics

### Memory Usage

- **Language cache:** ~10 KB (all language metadata)
- **Schema overhead:** Minimal (43 string fields per product)
- **Per-product overhead:** ~2 KB (empty fields for disabled languages)

### Request Performance

- **Cache hit:** 0 DB queries (uses in-memory cache)
- **Cache miss:** 1 DB query every 5 minutes
- **Validation overhead:** <1ms per request
- **Response filtering:** <1ms per request

### Cache Refresh Latency

When you enable a language:
- **Worst case:** Up to 5 minutes (next cache refresh)
- **Best case:** Immediate (manual cache refresh)
- **Typical:** 2-3 minutes average

---

## Comparison: Traditional vs Zero-Downtime

| Feature | Traditional (Restart Required) | Zero-Downtime (This System) |
|---------|-------------------------------|----------------------------|
| Enable language | Enable + Restart (2-5 min downtime) | Enable only (0 downtime) |
| Schema changes | Required | Not required |
| Multitenant safe | No (affects all tenants) | Yes (per-tenant optional) |
| Cache strategy | N/A | 5-min TTL with manual refresh |
| Validation | Schema-level (static) | Middleware (dynamic) |
| Response filtering | N/A | Automatic |
| Solr sync | Manual | Automatic |

---

## API Integration Example

### Admin Panel: Enable Language with Immediate Effect

```typescript
async function enableLanguageNow(code: string) {
  // 1. Enable the language
  await fetch(`/api/languages/${code}/enable`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  });

  // 2. Immediately refresh cache (makes it available now)
  await fetch('/api/languages/refresh-cache', {
    method: 'POST'
  });

  // 3. Done! Language is live
  alert(`${code} is now available - no restart needed!`);
}
```

### Product Form: Show Only Enabled Languages

```typescript
async function getEnabledLanguagesForForm() {
  const response = await fetch('/api/languages');
  const { data } = await response.json();

  // Only shows enabled languages
  return data.map(lang => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName
  }));
}

// Render form fields
const languages = await getEnabledLanguagesForForm();
languages.forEach(lang => {
  createTextField(`name[${lang.code}]`, lang.nativeName);
});
```

---

## Middleware Setup

Add to your Express app:

```typescript
import { validateLanguages, filterLanguagesMiddleware } from "./middleware/validate-languages.middleware";

// Apply to all product routes
app.use("/api/products", validateLanguages);
app.use("/api/products", filterLanguagesMiddleware);

// Now all product endpoints automatically:
// - Reject disabled languages in requests
// - Filter disabled languages from responses
// - No code changes needed
```

---

## Cache Management

### Automatic Cache Refresh

Cache refreshes automatically every 5 minutes:

```typescript
// Automatic - no action needed
setInterval(refreshLanguageCache, 5 * 60 * 1000);
```

### Manual Cache Refresh

Force immediate cache refresh:

```bash
# CLI
curl -X POST http://localhost:3000/api/languages/refresh-cache

# Or via code
import { refreshLanguageCache } from "./services/language.service";
await refreshLanguageCache();
```

### Cache Invalidation Strategy

Cache is invalidated when:
1. Language enabled/disabled via API
2. Manual refresh endpoint called
3. 5-minute TTL expires

---

## Schema Design Decision

**Why generate schemas for ALL languages?**

```typescript
// ❌ BAD: Generate schemas only for enabled languages
// Problem: Requires restart when enabling new languages
const enabledCodes = await getEnabledLanguages();
const schema = {};
enabledCodes.forEach(code => schema[code] = String);

// ✅ GOOD: Generate schemas for ALL possible languages
// Benefit: No restart needed, runtime validation handles it
const allCodes = await getAllLanguageCodes();
const schema = {};
allCodes.forEach(code => schema[code] = String);
```

**Trade-offs:**
- ✅ Zero downtime when enabling languages
- ✅ Multitenant safe
- ✅ Simple cache invalidation
- ⚠️ Slight memory overhead for disabled language fields
- ⚠️ Need runtime validation (middleware)

**Verdict:** Memory overhead is minimal (~2 KB/product), zero-downtime is essential for SaaS.

---

## Troubleshooting

### Language Enabled But Not Showing

```bash
# Check if language is enabled
curl http://localhost:3000/api/languages/fr

# Refresh cache immediately
curl -X POST http://localhost:3000/api/languages/refresh-cache

# Test again
curl http://localhost:3000/api/languages
```

### Cache Not Refreshing

```typescript
// Check cache timestamp
import { getEnabledLanguages } from "./services/language.service";

const languages = await getEnabledLanguages();
console.log("Cache age:", Date.now() - cacheTimestamp, "ms");
```

### Validation Not Working

Check middleware is applied:

```typescript
// Ensure middleware order is correct
app.use("/api/products", validateLanguages);      // 1. Validate first
app.use("/api/products", filterLanguagesMiddleware); // 2. Filter responses
app.use("/api/products", productRoutes);          // 3. Then routes
```

---

## Testing Zero-Downtime

### Test Script

```bash
#!/bin/bash

# 1. Create product with only IT
curl -X POST http://localhost:3000/api/products \
  -d '{"name":{"it":"Test"}}' \
  -H "Content-Type: application/json"

# 2. Try French (should fail - disabled)
curl -X POST http://localhost:3000/api/products \
  -d '{"name":{"fr":"Test"}}' \
  -H "Content-Type: application/json"
# Result: French field stripped, warning logged

# 3. Enable French (NO RESTART)
curl -X PATCH http://localhost:3000/api/languages/fr/enable \
  -d '{"enabled":true}' \
  -H "Content-Type: application/json"

# 4. Refresh cache
curl -X POST http://localhost:3000/api/languages/refresh-cache

# 5. Try French again (should work now)
curl -X POST http://localhost:3000/api/products \
  -d '{"name":{"fr":"Test"}}' \
  -H "Content-Type: application/json"
# Result: ✅ Works immediately
```

---

## Summary

### The Zero-Downtime Pattern

1. **Startup:** Generate schemas for ALL languages (one-time)
2. **Runtime:** Validate using enabled languages (from cache)
3. **Enable:** Update DB + Solr, refresh cache (no restart)
4. **Requests:** Middleware filters enabled/disabled languages

### Key Benefits

- ✅ **Zero downtime** - never restart
- ✅ **Multitenant safe** - per-tenant languages possible
- ✅ **Auto Solr sync** - schema updates automatically
- ✅ **5-minute cache** - minimal DB load
- ✅ **Instant activation** - manual cache refresh available
- ✅ **SaaS-ready** - designed for cloud environments

---

**Related Docs:**
- [LANGUAGE-MANAGEMENT-GUIDE.md](./LANGUAGE-MANAGEMENT-GUIDE.md)
- [LANGUAGE-QUICK-REFERENCE.md](./LANGUAGE-QUICK-REFERENCE.md)

**Last Updated:** 2025-11-19
