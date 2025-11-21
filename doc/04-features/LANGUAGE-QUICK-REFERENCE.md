# Language Management - Quick Reference

**TL;DR:** Enable/disable languages without code changes. System automatically updates Solr.

---

## Common Tasks

### List All Languages
```bash
npx ts-node src/scripts/manage-languages.ts list
```

### Enable a Language
```bash
# Enable French
npx ts-node src/scripts/manage-languages.ts enable fr

# ✅ Updates MongoDB
# ✅ Updates Solr schema automatically
# ⚠️  Restart app after
```

### Enable Multiple Languages
```bash
npx ts-node src/scripts/manage-languages.ts enable fr es pt ja zh
```

### Disable a Language
```bash
npx ts-node src/scripts/manage-languages.ts disable fr
```

### Sync Solr Schema
```bash
npx ts-node src/scripts/sync-solr-schema.ts
```

---

## REST API

```bash
# List languages
curl http://localhost:3000/api/languages

# Enable French
curl -X PATCH http://localhost:3000/api/languages/fr/enable \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Sync Solr
curl -X POST http://localhost:3000/api/languages/sync-solr
```

---

## After Enabling a Language

1. ✅ **No Restart Needed**
   - Changes are live immediately
   - Cache refreshes automatically (5-minute TTL)
   - Optional: Manual refresh for instant activation

2. ✅ **Verify Solr**
   - Check: `http://localhost:8983/solr/#/pim-products/schema`
   - Look for: `name_text_XX`, `description_text_XX` fields

3. ✅ **Test Product Creation**
   ```json
   {
     "name": {
       "it": "Tavolo",
       "fr": "Table"
     }
   }
   ```

---

## Available Languages (43 Total)

| Code | Language | Status | Analyzer |
|------|----------|--------|----------|
| it | Italian | ✅ Enabled | text_it |
| de | German | ✅ Enabled | text_de |
| en | English | ✅ Enabled | text_en |
| cs | Czech | ✅ Enabled | text_general |
| fr | French | ⭕ Disabled | text_fr |
| es | Spanish | ⭕ Disabled | text_es |
| pt | Portuguese | ⭕ Disabled | text_pt |
| ru | Russian | ⭕ Disabled | text_ru |
| ar | Arabic | ⭕ Disabled | text_ar (RTL) |
| ja | Japanese | ⭕ Disabled | text_ja |
| zh | Chinese | ⭕ Disabled | text_cjk |
| ... | +32 more | ⭕ Disabled | ... |

---

## Workflow

```
1. Enable language   → npx ts-node src/scripts/manage-languages.ts enable fr
2. Solr auto-updates → ✅ Adds name_text_fr, description_text_fr, etc.
3. Restart app       → pm2 restart vinc-pim
4. Use it            → Products can now have French translations
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Solr update failed | Run `npx ts-node src/scripts/sync-solr-schema.ts` |
| Language not accepted | Restart application |
| Can't disable default | Set different default first |
| Fields remain after disable | Normal - data preserved |

---

## Environment Variables

```env
SOLR_HOST=localhost
SOLR_PORT=8983
SOLR_CORE=pim-products
MONGODB_URI=mongodb://localhost:27017/pim
```

---

**Full Guide:** [LANGUAGE-MANAGEMENT-GUIDE.md](./LANGUAGE-MANAGEMENT-GUIDE.md)
