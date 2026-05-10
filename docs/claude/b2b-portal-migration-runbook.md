# B2B Portal Migration Runbook

This runbook is for operators running the Phase 1 migration for the B2B Portal
Refactor. The migration populates the new `b2bportals` collection from the
legacy `b2bhomesettings` data and backfills `portal_slug` on
`b2bhometemplates`.

Phase 1 introduces a **dual-state design**: until a tenant is migrated the new
`GET /api/b2b/b2b/portals/*` endpoints read-through to `b2bhomesettings` and
return a synthesized response (`synthesized: true`). Write endpoints (`PATCH`,
`DELETE`, save-draft, publish, etc.) return `409 NOT_MIGRATED` for unmigrated
tenants. All legacy paths (`/api/home-template/*`, `/api/b2b/home-settings/*`)
continue to work unchanged throughout Phase 1 — no UI changes are needed
before migration.

---

## Prerequisites

- Phase 1 code is deployed (this branch merged).
- Admin MongoDB access with read/write on tenant databases and the admin DB.
- Environment variable set: `VINC_MONGO_URL` — the MongoDB connection string
  (same value used by the Next.js app and other migration scripts).
- Bun installed on the machine running the scripts.

---

## Step 1: Dry-run for one tenant

Preview what the migration will do without writing anything:

```bash
bun run scripts/migrate-b2b-portal.ts --dry-run --tenant=dfl-it
```

Alternatively, use the `DRY_RUN` environment variable:

```bash
DRY_RUN=true bun run scripts/migrate-b2b-portal.ts --tenant=dfl-it
```

Read the logged output. Verify:

- A `[DRY-RUN dfl-it] would upsert portal:` line appears with the expected
  `slug` and `name` values.
- A `[DRY-RUN dfl-it] would backfill portal_slug on N HomeTemplate docs` line
  appears with a non-negative count.
- No errors are logged.

If the tenant has **no `b2bhomesettings` doc**, the script logs
`[dfl-it] skipped — no b2bhomesettings doc` and exits cleanly (status
`skipped`). This is a graceful no-op — do not treat it as a failure.

---

## Step 2: Run the migration for one tenant

```bash
bun run scripts/migrate-b2b-portal.ts --tenant=dfl-it
```

Expected console output (in order):

```
[dfl-it] dropped legacy index templateId_1_version_1   # or a no-op message
[dfl-it] upserted b2bportals doc with slug="default"
[dfl-it] backfilled portal_slug on N HomeTemplate docs
[dfl-it] marked migrated
[dfl-it] migration complete

Done. migrated=1 skipped=0 errors=0
```

Exits 0 on success, 1 on any error.

---

## Step 3: Verify the migration for one tenant

**Via the verify script:**

```bash
bun run scripts/verify-b2b-portal-migration.ts
```

(This checks all active tenants. Run it after migrating each tenant if
migrating incrementally, or after running `--all`.)

**Via direct MongoDB queries (connecting to the tenant DB `vinc-dfl-it`):**

```js
// Portal doc should exist with the expected branding/header/footer
db.b2bportals.findOne({ slug: "default" })

// No HomeTemplate docs should lack portal_slug
db.b2bhometemplates.countDocuments({ portal_slug: { $exists: false } })  // expect 0

// Audit log entry should exist in the admin DB
db.migration_log.findOne({ tenant_id: "dfl-it", result: "success" })
```

**Via the admin tenant doc (admin DB):**

```js
db.tenants.findOne({ tenant_id: "dfl-it" })
// → b2b_portal_migrated_at should be set to a timestamp
```

---

## Step 4: Smoke-test the new API

After migrating a tenant, confirm that the GET endpoint returns the real portal
(not a synthesized fallback):

```bash
curl -s -H "Authorization: Bearer <api-key>" \
  https://cs.vendereincloud.it/api/b2b/b2b/portals/default | jq .
```

The response should **not** contain `"synthesized": true`. If it does, the
tenant is not yet migrated (the flag check failed or the upsert did not commit).

---

## Step 5: Migrate all remaining tenants

Dry-run first:

```bash
bun run scripts/migrate-b2b-portal.ts --dry-run --all
```

Then run the live migration:

```bash
bun run scripts/migrate-b2b-portal.ts --all
```

The script processes all active tenants sequentially. Already-migrated tenants
are skipped (logged as `skipped — already migrated`). The summary line at the
end shows counts:

```
Done. migrated=N skipped=N errors=N
```

If `errors > 0` the script exits 1. Investigate each `[id] ERROR:` line and
re-run the affected tenants individually (see Troubleshooting below).

---

## Step 6: Verify all tenants migrated

```bash
bun run scripts/verify-b2b-portal-migration.ts
```

- Exit 0 + message `All active tenants migrated.` — ready for Phase 2.
- Exit 1 — prints the list of unmigrated tenant IDs. Run
  `bun run scripts/migrate-b2b-portal.ts --tenant=<id>` for each before
  proceeding.

This command is the CI gate for merging the Phase 2 PR.

---

## Rollback (single tenant)

The migration is non-destructive. The source data in `b2bhomesettings` and
`b2bhometemplates` is copied, not moved. Rolling back a tenant removes the
`b2bportals` "default" doc, unsets `portal_slug` from `b2bhometemplates`, and
clears `b2b_portal_migrated_at` from the admin tenant doc.

```bash
bun run scripts/migrate-b2b-portal.ts --rollback=dfl-it
```

Expected output:

```
[dfl-it] removed 1 b2bportals doc(s) with slug="default"
[dfl-it] unset portal_slug on N HomeTemplate doc(s)
[dfl-it] cleared b2b_portal_migrated_at flag

Rolled back tenant: dfl-it
```

After rollback the tenant reverts to read-through behaviour: GET endpoints
return `synthesized: true`, write endpoints return `409 NOT_MIGRATED`, and the
legacy UI works as before.

**Note:** The legacy index `templateId_1_version_1` is **not** recreated by
rollback. It is safe to leave it dropped — the new portal-scoped index
supersedes it.

---

## Re-running a migration (--force)

If you need to re-run the migration for an already-migrated tenant (for
example, after a settings change that needs to be re-synced from
`b2bhomesettings`):

```bash
bun run scripts/migrate-b2b-portal.ts --force --tenant=dfl-it
```

`--force` performs an upsert (not a duplicate insert), so it is safe to run
multiple times.

---

## Troubleshooting

### "index not found" or "ns not found" when dropping the legacy index

The script handles this gracefully — it logs nothing for a clean no-op and
a `non-fatal dropIndex warning:` line for other unexpected errors. Migration
continues regardless. This is not a failure.

### `b2bhomesettings` is missing for a tenant

The script logs `[id] skipped — no b2bhomesettings doc` and returns
`status: "skipped"`. This counts as a skip (not an error) in the summary.
The verify script will still flag this tenant as unmigrated if it's an active
tenant. Investigate whether the tenant has any home settings configured; if
they intentionally have no settings, they may be excluded from the gate
manually.

### A tenant ID is not found in the admin DB

```
Error: Unknown tenant: <id>
```

The tenant does not exist in the admin `tenants` collection with that
`tenant_id`. Check spelling or confirm the tenant is registered.

### `errors=N` in the summary

Each erroring tenant is logged with `[id] ERROR: <message>`. Run that tenant
individually to get the full stack trace:

```bash
bun run scripts/migrate-b2b-portal.ts --tenant=<id>
```

Fix the root cause, then re-run. Already-migrated tenants from the same
`--all` run will be skipped automatically.

### GET returns `synthesized: true` after migration

The tenant is not flagged as migrated in the admin DB. This means either:

- The migration script exited before completing step 5 (marking migrated). Run
  `bun run scripts/migrate-b2b-portal.ts --force --tenant=<id>` to complete it.
- The admin DB and tenant DB are on different connections and one failed. Check
  `VINC_MONGO_URL` points to the correct cluster.

### Write endpoints still return `409 NOT_MIGRATED` after migration

Same root cause as above — the migration flag was not written. Use `--force` to
re-run and check MongoDB directly:

```js
db.tenants.findOne({ tenant_id: "<id>" })
// b2b_portal_migrated_at must be a Date
```

---

## Cutover gate for Phase 2

The Phase 2 PR (new UI + legacy code cleanup) requires **all three** of the
following before merging:

1. `bun run scripts/verify-b2b-portal-migration.ts` exits 0 (all active
   tenants migrated).
2. The smoke test in Step 4 passes for every migrated tenant (no
   `synthesized: true` in the response).
3. A 24-hour soak window after the last tenant is migrated, with no errors in
   server logs matching `/api/b2b/b2b`.

Only then merge Phase 2.
