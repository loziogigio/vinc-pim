# vinc-demo swarm stack — deploy runbook

Target: stand up a **dedicated** Docker Swarm stack called `vinc-demo` on vinc-2 that
serves `demo-b2b.vendereincloud.it` in isolation from the production `vinc-cs-app` stack,
while sharing all backing resources (MongoDB, Redis/BullMQ, SolrCloud).

---

## 1. Architecture overview

```
                          vinc-2 (161.156.161.8)
                          Docker Swarm (single-node leader)
  ┌───────────────────────────────────────────────────────────┐
  │                                                           │
  │  Traefik (file provider)                                  │
  │  /www-data/stack/traefik/dynamic/*.yml                    │
  │  ↓ routes by Host header                                  │
  │                                                           │
  │  ┌──────────────────────┐  ┌───────────────────────────┐ │
  │  │  stack: vinc-cs-app  │  │  stack: vinc-demo  (NEW)  │ │
  │  │  service: vinc-b2b   │  │  service: vinc-b2b-demo   │ │
  │  │  (prod tenants)      │  │  DEMO_UI_ENABLED=true     │ │
  │  │  :3000               │  │  :3000                    │ │
  │  └──────────────────────┘  └───────────────────────────┘ │
  │           │                            │                  │
  │           └────────────────────────────┘                  │
  │                  shared overlay network                   │
  │  ┌────────────────────────────────────────────────────┐   │
  │  │  MongoDB  |  Redis  |  BullMQ  |  SolrCloud        │   │
  │  │  tenant db: vinc-demo-it  (demo-it tenant)         │   │
  │  └────────────────────────────────────────────────────┘   │
  └───────────────────────────────────────────────────────────┘

  DNS: *.vendereincloud.it wildcard → 161.156.161.8
  demo-b2b.vendereincloud.it → Traefik → vinc-b2b-demo service
```

**Isolation model:** Only the swarm stack/service is separate. The `demo-it` tenant
already exists in the shared MongoDB cluster (`vinc-demo-it` database); Solr collection
`vinc-demo-it` is on the same SolrCloud. The demo stack can be restarted, scaled to
zero, or rebuilt without touching any production service.

**Why DEMO_UI_ENABLED is a runtime env (not build-time):** vinc-b2b is built with
`TENANT_MODE=multi` and resolves the tenant from the `Host` header via middleware at
request time. The demo banner/checklist is a runtime feature flag read from `process.env`
inside the server. The same `crowdechain/vinc-b2b` image that runs in production also
runs in the demo stack — only the environment differs.

---

## 2. Build the vinc-b2b demo image

The demo stack uses the **standard multi-tenant image** `crowdechain/vinc-b2b`. No
separate build or tag is needed; `DEMO_UI_ENABLED=true` is injected at runtime.

**Source:** `vinc-b2b/` repo. Build config: `vinc-b2b/.env.deploy.multi`.

### 2a. Check current version

```bash
# in vinc-b2b/
grep '^VERSION=' .env.deploy.multi
# → e.g. VERSION=2.9.21
```

### 2b. Build

```bash
cd /path/to/vinc-b2b
./build-docker.sh              # reads VERSION from .env.deploy.multi
# or with an explicit version:
./build-docker.sh 2.9.21
```

`build-docker.sh` bakes all `NEXT_PUBLIC_*` vars as Docker build-args. Runtime-only
vars (MONGO_URL, TENANTS_DB, SSO_CLIENT_SECRET, DEMO_UI_ENABLED, REDIS_HOST …) are
**NOT** baked and must be injected via the stack compose.

### 2c. Ship to vinc-2 (Docker Hub push denied — use save/load)

```bash
VERSION=2.9.21
IMAGE=crowdechain/vinc-b2b

docker save "${IMAGE}:${VERSION}" | gzip \
  | ssh vinc-2 'gunzip | sudo -n docker load'
```

> **CONFIRM-ON-VINC-2:** Verify the `vinc-2` SSH alias is configured locally
> (`~/.ssh/config` or equivalent with passwordless sudo). The pattern is copied from
> `deploy-vinc-www.sh` which uses `ssh vinc-2 'sudo -n docker load'`.

---

## 3. Stack compose for `vinc-demo`

Create this file on vinc-2 at `/www-data/stack/vinc-demo/stack.yml`.
Also create `/www-data/stack/vinc-demo/.env` with the secrets (see section 3b).

### 3a. `/www-data/stack/vinc-demo/stack.yml`

```yaml
# vinc-demo swarm stack
# Serves demo-b2b.vendereincloud.it on the vinc-demo tenant (demo-it).
# Traefik routing is file-provider (see /www-data/stack/traefik/dynamic/vinc-demo-b2b.yml).
# Sharing backing services (Mongo, Redis, Solr) with vinc-cs-app via the same overlay network.
version: "3.8"

services:
  vinc-b2b-demo:
    image: crowdechain/vinc-b2b:2.9.21         # bump this on each deploy
    environment:
      # ── Multi-tenant resolution ──────────────────────────────────────────
      TENANT_MODE: multi
      MONGO_URL: "${DEMO_MONGO_URL}"            # from .env
      TENANTS_DB: vinc-tenants                  # CONFIRM-ON-VINC-2: actual admin tenants DB name

      # ── CS SSO (same CS app as production) ──────────────────────────────
      SSO_API_URL: https://cs.vendereincloud.it
      SSO_CLIENT_ID: vinc-b2b
      SSO_CLIENT_SECRET: "${SSO_CLIENT_SECRET}" # from .env

      # ── Demo feature flags (RUNTIME — same image as prod) ────────────────
      DEMO_UI_ENABLED: "true"
      DEMO_ADMIN_PASSWORD: "${DEMO_ADMIN_PASSWORD}"
      DEMO_B2B_PASSWORD: "${DEMO_B2B_PASSWORD}"
      DEMO_B2C_PASSWORD: "${DEMO_B2C_PASSWORD}"

      # ── Optional: Redis push-invalidation cache ──────────────────────────
      # REDIS_HOST: redis                       # CONFIRM-ON-VINC-2: service name on overlay net
      # REDIS_PORT: "6379"

      # ── Node tunables ─────────────────────────────────────────────────────
      POOL_MAX_CONNECTIONS: "20"               # smaller pool — demo only
      POOL_PER_DB_SIZE: "5"
      POOL_TTL_MS: "1800000"
      TENANT_CACHE_TTL_SECONDS: "300"

    ports: []                                  # Traefik fronts this; no host port exposed

    networks:
      - vinc_net                               # CONFIRM-ON-VINC-2: shared overlay network name

    deploy:
      replicas: 1
      update_config:
        order: start-first
        failure_action: rollback
      placement:
        constraints:
          - node.hostname == vinc-2            # CONFIRM-ON-VINC-2: swarm node hostname

networks:
  vinc_net:
    external: true                             # CONFIRM-ON-VINC-2: must match existing overlay network
```

### 3b. `/www-data/stack/vinc-demo/.env` (secrets — create manually on vinc-2)

```bash
# Never commit this file.
DEMO_MONGO_URL=mongodb://root:<PASSWORD>@mongo:27017/?authSource=admin
SSO_CLIENT_SECRET=<same-secret-as-production-vinc-b2b>
DEMO_ADMIN_PASSWORD=<chosen-admin-password>
DEMO_B2B_PASSWORD=<chosen-b2b-buyer-password>
DEMO_B2C_PASSWORD=<chosen-b2c-shopper-password>
```

> **CONFIRM-ON-VINC-2:** Read the Mongo URL from the existing `vinc-cs-app` stack's
> env or from `/www-data/stack/vinc-cs-app/.env` (or equivalent). The `SSO_CLIENT_SECRET`
> must match what the existing `vinc-b2b` service uses (same CS app).

---

## 4. Traefik dynamic route file

The vinc-2 Traefik instance uses a **file provider** watching
`/www-data/stack/traefik/dynamic/*.yml` with `watch:true`. Drop a new `.yml` there and
it auto-reloads — no Traefik restart needed.

### 4a. Create `/www-data/stack/traefik/dynamic/vinc-demo-b2b.yml` on vinc-2

```yaml
http:
  routers:
    vinc-demo-b2b:
      rule: Host(`demo-b2b.vendereincloud.it`)
      entryPoints:
        - websecure
      service: vinc-b2b-demo@file
      middlewares:
        - chain-public@file
      tls:
        certResolver: letsencrypt
      priority: 95                # higher than prod b2b-tenants (90) so no ambiguity

  services:
    vinc-b2b-demo:
      loadBalancer:
        servers:
          - url: "http://vinc-b2b-demo:3000"  # Docker Swarm service name on shared overlay
```

> **CONFIRM-ON-VINC-2 (critical):** Verify two things before writing this file:
> 1. `chain-public@file` exists in an existing dynamic `.yml` (it is referenced in
>    `.traefik/b2b-tenants.yml` and `.traefik/b2c-storefronts.yml` in the repo — the
>    server-side definition must already be present).
> 2. Traefik can reach the `vinc-b2b-demo` container by that name over the shared overlay.
>    If Traefik is not on the same overlay, expose an internal port and reference the
>    host IP instead. Check with:
>    ```bash
>    docker network inspect <vinc_net_name> | grep -A3 traefik
>    ```

### 4b. Confirm Let's Encrypt cert

`demo-b2b.vendereincloud.it` is covered by the `*.vendereincloud.it` wildcard DNS, so
ACME will issue a cert on first request. If using a wildcard cert (DNS challenge) it
covers all subdomains automatically. No extra DNS step is needed.

---

## 5. Deploy commands

Run these from your local machine (or on vinc-2 directly).

```bash
# 1. Build + ship image (from vinc-b2b/ locally)
VERSION=2.9.21
cd /path/to/vinc-b2b
./build-docker.sh "${VERSION}"
docker save "crowdechain/vinc-b2b:${VERSION}" | gzip \
  | ssh vinc-2 'gunzip | sudo -n docker load'

# 2. Create server-side directories on vinc-2
ssh vinc-2 'sudo -n mkdir -p /www-data/stack/vinc-demo'

# 3. Upload stack files (from local repo — adjust paths)
scp /path/to/stack.yml vinc-2:/tmp/vinc-demo-stack.yml
ssh vinc-2 'sudo -n mv /tmp/vinc-demo-stack.yml /www-data/stack/vinc-demo/stack.yml'

# 4. Create .env on vinc-2 (write manually — never commit)
ssh vinc-2 'sudo -n nano /www-data/stack/vinc-demo/.env'
# ... fill in DEMO_MONGO_URL, SSO_CLIENT_SECRET, DEMO_*_PASSWORD

# 5. Drop the Traefik route (auto-reloads — no Traefik restart)
scp /path/to/vinc-demo-b2b.yml vinc-2:/tmp/
ssh vinc-2 'sudo -n mv /tmp/vinc-demo-b2b.yml /www-data/stack/traefik/dynamic/vinc-demo-b2b.yml'

# 6. Deploy the stack
ssh vinc-2 bash -s <<'REMOTE'
  set -e
  cd /www-data/stack/vinc-demo
  sudo -n bash -c 'set -a; source ./.env; set +a; \
    docker stack deploy --detach=false \
      --with-registry-auth \
      -c stack.yml \
      vinc-demo'
REMOTE

# 7. Verify the service came up
ssh vinc-2 'sudo -n docker service ps vinc-demo_vinc-b2b-demo'
```

### On subsequent image bumps

```bash
VERSION=2.9.22
# ... build + save|load as above, then on vinc-2:
ssh vinc-2 bash -s <<REMOTE
  set -e
  cd /www-data/stack/vinc-demo
  sudo -n cp stack.yml "stack.yml.bak-\$(date +%Y%m%d-%H%M%S)"
  sudo -n sed -i "s#crowdechain/vinc-b2b:[0-9.][0-9.]*#crowdechain/vinc-b2b:${VERSION}#" stack.yml
  sudo -n bash -c 'set -a; source ./.env; set +a; docker stack deploy --detach=false -c stack.yml vinc-demo'
REMOTE
```

---

## 6. One-time data steps (pair with first deploy)

These are run from the CS repo on a machine that can reach MongoDB and Solr.
They are **idempotent** — safe to re-run.

### 6a. Enable `is_demo` flag on the tenant document

```bash
# On vinc-2 (or a machine with mongosh access)
mongosh "${DEMO_MONGO_URL}" --eval '
  use vinc-admin;
  db.tenants.updateOne(
    { tenant_id: "demo-it" },
    { $set: { "features.is_demo": true } }
  );
  printjson(db.tenants.findOne({ tenant_id: "demo-it" }, { features: 1 }));
'
```

> **CONFIRM-ON-VINC-2:** The admin tenants database may be named `vinc-admin`,
> `vinc-tenants`, or similar. Check the CS app env (`TENANTS_DB`) or inspect:
> `show dbs` in mongosh.

### 6b. Provision the demo tenant (CS repo)

This script is idempotent. It creates the `demo-it` tenant (if missing), seeds sales
channels, demo customers, portal users and the Velia Ferramenta catalog (60 SKUs).

```bash
cd /path/to/vinc-commerce-suite

# Dry run first — no DB writes:
DEMO_ADMIN_PASSWORD=x DEMO_B2B_PASSWORD=y DEMO_B2C_PASSWORD=z \
  npx tsx scripts/demo/provision-demo-tenant.ts --dry-run

# Full provision (requires VINC_MONGO_URL pointing at the shared Mongo):
VINC_MONGO_URL="mongodb://root:<PASSWORD>@<host>:27017/?authSource=admin" \
DEMO_ADMIN_PASSWORD=<admin-pwd> \
DEMO_B2B_PASSWORD=<b2b-pwd> \
DEMO_B2C_PASSWORD=<b2c-pwd> \
  npx tsx scripts/demo/provision-demo-tenant.ts
```

Source: `scripts/demo/provision-demo-tenant.ts` + `scripts/demo/seed-helpers.ts`

### 6c. Solr reindex

After provisioning, sync the demo catalog to Solr so search works:

```bash
VINC_MONGO_URL="..." \
SOLR_URL="http://<solr-host>:8983/solr" \
SOLR_ENABLED=true \
  npx tsx scripts/demo/sync-demo-solr.ts
```

Source: `scripts/demo/sync-demo-solr.ts`

> **CONFIRM-ON-VINC-2:** The SolrCloud host. From the existing CS `.env.deploy`:
> `SOLR_URL=http://solr:8983/solr` (Docker service name `solr` on the shared overlay).
> From outside the swarm, use the public IP or ssh tunnel.

### 6d. Install the reset cron

The demo resets nightly (soft) and weekly (hard) to clear test orders/carts and
re-publish branding.

```bash
# On vinc-2:
# 1. Confirm the CS app directory path (ASSUMPTION: /home/it/vinc-commerce-suite
#    or wherever the CS repo is checked out on the server — must have node_modules)
# 2. Copy the cron fragment:
sudo cp /path/to/vinc-commerce-suite/ops/demo/demo-reset.crontab /etc/cron.d/vinc-demo

# 3. Edit the placeholder path:
sudo sed -i 's|/CONFIRM/ON/VINC-2|/home/it/vinc-commerce-suite|g' /etc/cron.d/vinc-demo
sudo chmod 644 /etc/cron.d/vinc-demo
```

Source: `ops/demo/demo-reset.crontab`, `ops/demo/demo-reset.sh`

The crontab runs:
- Nightly 03:30 Mon–Sat: `demo-reset.sh soft` (wipes test orders/carts, re-seeds)
- Sunday 04:00: `demo-reset.sh hard` (also drops/re-applies branding, re-publishes home)

`demo-reset.sh` reads `VINC_CS_DIR` from its cron env; falls back to
`/home/it/vinc-commerce-suite`. The `.env` in that directory supplies `VINC_MONGO_URL`,
`SOLR_*`, and `DEMO_*_PASSWORD`.

---

## 7. Verification checklist

Run these after the stack is up and data steps are complete.

### 7a. Service health

```bash
ssh vinc-2 'sudo -n docker service ps vinc-demo_vinc-b2b-demo --format "{{.Image}} {{.CurrentState}}"'
# Expected: crowdechain/vinc-b2b:2.9.21  Running ...
```

### 7b. Homepage loads with real content

```bash
curl -fsSL -o /dev/null -w "%{http_code}" https://demo-b2b.vendereincloud.it/it/
# Expected: 200

# Check demo banner is present (DEMO_UI_ENABLED=true)
curl -fsSL https://demo-b2b.vendereincloud.it/it/ | grep -i "demo" | head -5
```

### 7c. Tenant resolves to demo-it (not a production tenant)

```bash
curl -fsSL https://demo-b2b.vendereincloud.it/api/health 2>/dev/null || true
# Or check the CS admin: tenant 'demo-it' should show hostname demo-b2b.vendereincloud.it
```

### 7d. Product catalog visible (Solr indexed)

Navigate to `https://demo-b2b.vendereincloud.it/it/search` — should show Velia
Ferramenta products (60 SKUs across 6 ferramenta categories).

### 7e. Per-persona pricing (logged-in)

1. Log in as `buyer1@demo.vendereincloud.it` (DEMO_B2B_PASSWORD) → Rossi Forniture
   (premium tier, −15%)
2. Log in as `buyer2@demo.vendereincloud.it` (DEMO_B2B_PASSWORD) → Bianchi Distribuzione
   (standard tier, −7%)
3. Compare prices on the same SKU — buyer1 should see lower list prices.

### 7f. Order history / documents visible

Log in as buyer1 → Riordina / Documenti tabs should show seeded 8-month history
(`relation_id = "DEMO-C01"`, channel `b2b`).

### 7g. Demo banner/checklist present

The demo banner/persona switcher should appear on every page for logged-in users
(feature gated by `DEMO_UI_ENABLED=true` on this stack). The same SKU visited on any
**production** tenant URL (e.g. `hidros-b2b.vendereincloud.it`) should show NO banner.

### 7h. Production stack unaffected

```bash
# Production b2b tenants still respond
curl -fsSI https://hidros-b2b.vendereincloud.it/ | head -1
# Expected: HTTP/2 200
```

---

## 8. Rollback

### Remove the demo stack

```bash
ssh vinc-2 'sudo -n docker stack rm vinc-demo'
```

### Remove the Traefik route (stops routing immediately, auto-reload)

```bash
ssh vinc-2 'sudo -n rm /www-data/stack/traefik/dynamic/vinc-demo-b2b.yml'
```

No DNS change needed — the wildcard DNS entry remains, but Traefik will return 404
for `demo-b2b.vendereincloud.it` once the route file is gone.

### Restore a previous image version

```bash
VERSION_PREV=2.9.20
ssh vinc-2 "sudo -n docker service update \
  --image crowdechain/vinc-b2b:${VERSION_PREV} \
  vinc-demo_vinc-b2b-demo"
```

---

## Appendix: verified source files

| Fact | Source file |
|---|---|
| Build script invocation + image name | `vinc-b2b/build-docker.sh` |
| Runtime vs build-time env split | `vinc-b2b/Dockerfile`, `vinc-b2b/.env.deploy.multi` |
| Tenant resolution via Host header (middleware) | `vinc-b2b/middleware.ts` |
| Traefik file-provider pattern + service naming | `vinc-commerce-suite/.traefik/b2b-tenants.yml`, `.traefik/b2c-storefronts.yml` |
| save/load deploy pattern (no Hub push) | `deploy-vinc-www.sh` (parent dir) |
| Stack deploy commands + `.env` sourcing | `deploy-vinc-www.sh` |
| Demo tenant ID, DB name, domains | `src/lib/demo/demo-access.ts` |
| Demo customers (external_code DEMO-C01/C02) | `scripts/demo/demo-config.ts` |
| Provision script | `scripts/demo/provision-demo-tenant.ts` |
| Solr sync script | `scripts/demo/sync-demo-solr.ts` |
| Reset cron + shell wrapper | `ops/demo/demo-reset.crontab`, `ops/demo/demo-reset.sh` |

---

## Top 3 things to CONFIRM on vinc-2 before running

1. **Shared overlay network name.** The stack compose references `vinc_net` (assumed).
   Run `docker network ls | grep overlay` on vinc-2 to find the actual name, then update
   `stack.yml` `networks:` and the Traefik service URL accordingly. If Traefik is not on
   this overlay, the file-provider `url: http://vinc-b2b-demo:3000` will not resolve and
   you must use a host-mode port + IP instead.

2. **CS repo path on vinc-2 for the reset cron.** The cron wrapper (`ops/demo/demo-reset.sh`)
   calls `npx tsx scripts/demo/reset-demo-tenant.ts` from `APP_DIR`. This requires the CS
   repo to be checked out on vinc-2 with `node_modules` installed. Confirm the path and
   set `VINC_CS_DIR` in the crontab accordingly (the placeholder is `/CONFIRM/ON/VINC-2`).

3. **Admin tenants DB name (`TENANTS_DB`).** The vinc-b2b multi-tenant service reads
   tenant configs from a MongoDB database named via `TENANTS_DB` (not in `.env.deploy.multi`
   — it is runtime-only). Check the existing production `vinc-cs-app` stack's env or the
   running container: `docker exec <b2b-container> env | grep TENANTS_DB`. This value goes
   into the demo stack's `stack.yml` `TENANTS_DB:` field. Getting this wrong means the demo
   stack will fail to resolve any tenant at all.
