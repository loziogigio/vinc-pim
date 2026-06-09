# Importing Dynamic Blocks (PIM)

Dynamic blocks are per‑product rich content (image / video / 3D / text grids) shown on the B2B
product detail page. They live on the `pimproducts` document as a `dynamic_blocks` array (Mongo
only — excluded from Solr) and are attached to the storefront response by a gated enrichment step.
Each block belongs to exactly **one language**.

This note covers importing them through the existing PIM import API. There is **no separate
endpoint** — `dynamic_blocks` is an optional field on each product in the import payload.
A validated, ready‑to‑POST sample + an integrator‑facing guide live in
`doc/export/time-to-pim/` (`DYNAMIC_BLOCKS_IMPORT_GUIDE.md`, `test-json/dynamic-blocks-sample.json`).

## Where it goes

Add `dynamic_blocks` to any product in the `products[]` array of a normal import body and POST to
the standard import route (API‑key auth):

```
POST {PIM_API_URL}/api/b2b/pim/import/api      # synchronous
POST {PIM_API_URL}/api/b2b/pim/import/queue    # same body, queued (BullMQ)

Headers: Content-Type: application/json
         x-auth-method: api-key
         x-api-key-id:  ak_<tenant>_xxxx
         x-api-secret:  sk_xxxx
```

Products are upserted by `entity_code` (falling back to `sku`).

## Language rules — read this first

`lang` on each block must be:

1. **One of the TENANT's enabled languages.** Validation is tenant‑aware: it checks the per‑tenant
   `languages` collection (`Language` model, `isEnabled: true`) — **not** a global static list.
   The enabled set is what you see under **PIM → Lingue**. A block in a language the tenant hasn't
   enabled is rejected. (Resolved server‑side via `getTenantLanguageCodes(tenantDb)` in
   `src/lib/services/tenant-languages.ts`; the validator `validateDynamicBlocks(blocks, allowedLangCodes)`
   in `src/lib/validation/dynamic-blocks.ts` takes the codes as a parameter.)

2. **Lowercase.** Language codes are stored lowercase (the `Language.code` field is `lowercase: true`)
   and the match is **case‑sensitive**. `"EN"` is rejected; use `"en"`. Same for `"it"`, `"fr"`, etc.
   The storefront also filters blocks by the lowercase URL language, so an uppercase code would never
   render even if it slipped through.

## Two behaviors that bite

- **`dynamic_blocks` fully REPLACES** the product's existing blocks — it is not merged. Send the
  complete set every time; omit the field to leave blocks untouched; send `[]` to clear them.
- **Validation is all‑or‑nothing per product.** The whole `dynamic_blocks` array is validated; if
  **any** block/element is invalid (e.g. an uppercase or non‑enabled `lang`, a bad `section`/`columns`,
  an unsafe URL), the importer **silently drops the entire `dynamic_blocks` field for that product**
  and records a `field: "dynamic_blocks"` warning on the import job — the product still imports, just
  without blocks. ➡️ Always check the import job's `warnings`, and validate before sending.

## Schema (per block)

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | non‑empty (stable, e.g. a UUID) |
| `lang` | string | a tenant‑enabled, **lowercase** language code (see above) |
| `title` | string? | heading in `lang` |
| `section` | number | `1`–`4` |
| `order` | number | sort order within `(section, lang)` |
| `columns` | integer | `1`–`8` |
| `is_active` | boolean | `false` hides without deleting |
| `elements` | array | ≤ 24 elements |

Per element: `id` (non‑empty) + `kind` (`image`/`video`/`3d`/`text`). Media kinds carry
`media.url` (non‑empty, **safe URL** = `http(s)` absolute or site‑relative `/…`; no
`javascript:`/`data:`/`//`), plus optional `media.cdn_key`/`is_external_link`/`alt`. Text carries
`text` (non‑empty). Any element may carry `description` and `link { href (safe), new_tab }`.

Limits: ≤ 20 blocks/product, ≤ 24 elements/block.

## Code map

- Validator (shared by importer + the PIM PATCH route): `src/lib/validation/dynamic-blocks.ts`
  (`validateDynamicBlocks(blocks, allowedLangCodes)`, `sanitizeDynamicBlocks`, `normalizeUrl`).
- Tenant language codes: `src/lib/services/tenant-languages.ts`.
- Importer handling: `src/lib/queue/import-worker.ts` (`applyDynamicBlocksToUpdate` update path,
  `sanitizeDynamicBlocksForCreate` create path — both validate against the tenant's enabled codes).
- Types/constants: `src/lib/types/dynamic-blocks.ts`, `src/lib/constants/dynamic-blocks.ts`.
