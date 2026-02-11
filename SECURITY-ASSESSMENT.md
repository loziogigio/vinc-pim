# VINC Commerce Suite - Security Assessment Report

**Target:** `cs.vendereincloud.it` (149.81.163.109)
**Date:** 2026-02-10
**Type:** Full security assessment (passive + active + code review)
**Scope:** Infrastructure, network, HTTP, TLS, dependencies, OWASP Top 10 code review

---

## Executive Summary

The VINC Commerce Suite has **4 CRITICAL** and **8 HIGH** severity vulnerabilities that require immediate attention. The most dangerous findings are **publicly exposed database and service ports without authentication** — Redis, Solr, MongoDB, and PostgreSQL are all reachable from the public internet.

| Severity | Count | Category |
|----------|-------|----------|
| **CRITICAL** | 4 | Infrastructure (3), Access Control (1) |
| **HIGH** | 8 | Dependencies (2), Cryptographic (2), Design (2), Logging (1), Access Control (1) |
| **MEDIUM** | 12 | CORS, config, SSRF, file validation, headers, Docker |
| **LOW** | 2 | Info disclosure, file extension |

---

## SECTION 1: INFRASTRUCTURE & NETWORK

### VULN-001: Redis Exposed to Public Internet WITHOUT Authentication
**Severity: CRITICAL**
**Port:** 6379 (149.81.163.109)

Redis is accessible from the public internet with **zero authentication**. Verified:

```
$ (printf "PING\r\n"; sleep 1) | nc 149.81.163.109 6379
+PONG

$ (printf "DBSIZE\r\n"; sleep 2) | nc 149.81.163.109 6379
:8672

$ (printf "INFO server\r\n"; sleep 2) | nc 149.81.163.109 6379
redis_version:6.2.21
os:Linux 5.15.0-1055-ibm x86_64
process_id:1  (running as PID 1 in Docker)
uptime_in_days:58
tcp_port:6379
```

**Impact:**
- **8,672 keys** are readable/writable/deletable by anyone on the internet
- BullMQ job data (potentially containing business data) is exposed
- Session tokens may be cached in Redis
- An attacker can execute `FLUSHALL` to destroy all data
- Redis can be weaponized for RCE via `CONFIG SET dir/dbfilename` attacks
- Data exfiltration of all cached business data

**Remediation:**
1. **IMMEDIATE:** Block port 6379 in firewall (`ufw deny 6379` or iptables)
2. Set `requirepass` in Redis configuration
3. Bind Redis to `127.0.0.1` or Docker internal network only
4. Use Redis ACLs (available since Redis 6.0)
5. Consider Redis over TLS for inter-service communication

---

### VULN-002: Solr Admin Interface Exposed to Public Internet
**Severity: CRITICAL**
**Port:** 8983 (149.81.163.109)

SolrCloud admin interface is publicly accessible with no authentication:

```
$ curl http://149.81.163.109:8983/solr/admin/collections?action=LIST&wt=json
{
  "collections": [
    "app",
    "vinc-base-int",
    "vinc-crowdechain-cz",
    "vinc-dfl-eventi-it",
    "vinc-dfl-it",
    "vinc-hidros-it",
    "vinc-test-api-ml0evubp"
  ]
}
```

The full Solr web UI is also accessible at `http://149.81.163.109:8983/solr/`.

**Impact:**
- All tenant names and collections are enumerable
- Full product catalog data for ALL tenants is queryable
- Collections can be DELETED (`action=DELETE&name=vinc-hidros-it`)
- Schema can be modified, data can be corrupted
- Complete data exfiltration of all indexed product/search data

**Remediation:**
1. **IMMEDIATE:** Block port 8983 in firewall
2. Configure Solr authentication plugin (BasicAuth or PKI)
3. Bind Solr to Docker internal network only
4. Use nginx reverse proxy with authentication for admin access
5. Enable Solr audit logging

---

### VULN-003: MongoDB Exposed to Public Internet
**Severity: CRITICAL**
**Port:** 27017 (149.81.163.109)

MongoDB port is open to the public internet. While authentication status couldn't be fully verified (no `mongosh` available), the port accepts connections.

**Impact (if auth is weak/missing):**
- All tenant databases (`vinc-hidros-it`, `vinc-dfl-eventi-it`, etc.) accessible
- Customer PII, orders, financial data exposed
- Data can be modified or deleted
- Ransomware attacks (encrypt DB, demand payment)

**Remediation:**
1. **IMMEDIATE:** Block port 27017 in firewall
2. Ensure MongoDB authentication is enabled (`--auth` flag)
3. Bind to 127.0.0.1 or Docker internal network
4. Use strong passwords (not defaults)
5. Enable MongoDB audit logging
6. Use TLS for MongoDB connections

---

### VULN-004: PostgreSQL Exposed to Public Internet
**Severity: CRITICAL**
**Port:** 5432 (149.81.163.109)

PostgreSQL port is open to the public internet.

**Impact:**
- Brute force attacks on database credentials
- If weak credentials, full database access
- Data exfiltration, modification, deletion

**Remediation:**
1. **IMMEDIATE:** Block port 5432 in firewall
2. Ensure `pg_hba.conf` restricts connections to localhost/Docker network
3. Use strong passwords
4. Enable SSL for PostgreSQL connections

---

### VULN-005: SSH Version Exposed
**Severity: LOW**
**Port:** 22 (149.81.163.109)

SSH is accessible (expected for admin access). Ensure it's properly hardened.

**Remediation:**
- Disable password authentication (use key-only)
- Use fail2ban for brute force protection
- Consider non-standard port
- Restrict to VPN/specific IP ranges

---

### Open Ports Summary

| Port | Service | Status | Risk |
|------|---------|--------|------|
| 22 | SSH | OPEN | Low (expected) |
| 80 | HTTP | OPEN | OK (redirects to HTTPS) |
| 443 | HTTPS | OPEN | OK (expected) |
| 5432 | PostgreSQL | **OPEN** | **CRITICAL** |
| 6379 | Redis | **OPEN (NO AUTH)** | **CRITICAL** |
| 8983 | Solr | **OPEN (NO AUTH)** | **CRITICAL** |
| 27017 | MongoDB | **OPEN** | **CRITICAL** |

---

## SECTION 2: TLS & CERTIFICATE

### TLS Configuration - GOOD

| Check | Result | Status |
|-------|--------|--------|
| TLS 1.0 | Disabled | PASS |
| TLS 1.1 | Disabled | PASS |
| TLS 1.2 | Enabled (ECDHE-ECDSA-AES256-GCM-SHA384) | PASS |
| TLS 1.3 | Enabled (TLS_AES_256_GCM_SHA384) | PASS |
| Certificate | Let's Encrypt, ECDSA P-256, Wildcard | PASS |
| HTTP redirect | 301 to HTTPS | PASS |

### VULN-006: Certificate Expiring Soon
**Severity: MEDIUM**

Certificate expires **March 15, 2026** (33 days from assessment date).

**Remediation:**
- Verify certbot auto-renewal is configured and working
- Test renewal: `certbot renew --dry-run`
- Set up monitoring alert for certificate expiration

---

## SECTION 3: HTTP SECURITY HEADERS

### VULN-007: Missing Critical Security Headers
**Severity: MEDIUM**

Headers analysis for `https://cs.vendereincloud.it/login`:

| Header | Status | Expected |
|--------|--------|----------|
| `server: nginx` | PRESENT (leaks info) | Remove or set to generic |
| `x-powered-by: Next.js` | PRESENT (leaks info) | Remove |
| `Strict-Transport-Security` | **MISSING** | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | **MISSING** | Define restrictive CSP |
| `X-Frame-Options` | PRESENT (on API only) | Add to all pages |
| `X-Content-Type-Options` | PRESENT (on API only) | Add to all pages |
| `Referrer-Policy` | PRESENT (on API only) | Add to all pages |
| `Permissions-Policy` | PRESENT (on API only) | Add to all pages |

**Key issue:** Security headers are only applied to API routes, NOT to page routes (login, dashboard, etc.).

**Remediation:**
1. Add HSTS header in nginx config: `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;`
2. Remove `x-powered-by` in `next.config.ts`: add `poweredByHeader: false`
3. Hide nginx version: `server_tokens off;` in nginx.conf
4. Apply security headers to ALL routes in middleware (not just API routes)
5. Add Content-Security-Policy header

---

### VULN-008: Nginx Version Leaked on HTTP
**Severity: LOW**

HTTP response reveals exact nginx version:
```
Server: nginx/1.29.4
```
HTTPS only reveals `server: nginx` (without version).

**Remediation:** Add `server_tokens off;` to nginx.conf http block.

---

### VULN-009: CORS Wildcard on All API Routes
**Severity: HIGH**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-ID, ...
```

**File:** `src/middleware.ts:6`

**Impact:**
- Any website can make authenticated API requests to your backend
- Combined with session cookies or leaked API keys, enables CSRF attacks
- State-changing operations (POST, PUT, DELETE) are allowed from any origin

**Remediation:**
- Replace `*` with explicit origin whitelist:
  ```typescript
  const ALLOWED_ORIGINS = [
    "https://cs.vendereincloud.it",
    "https://demo.vinc.trade",
    process.env.NEXT_PUBLIC_CUSTOMER_WEB_URL,
  ].filter(Boolean);
  ```
- Validate `Origin` header against whitelist
- Return specific origin, not wildcard

---

## SECTION 4: DNS & DOMAIN

| Record | Value | Notes |
|--------|-------|-------|
| A | 149.81.163.109 | IBM Cloud |
| NS | ns1.register.it, ns2.register.it | |
| MX | 10 mail.register.it | |
| TXT/SPF | `v=spf1 include:spf.webapps.net ~all` | Uses softfail (~all), should be -all |
| robots.txt | Present | Sitemap points to `demo.vinc.trade` |
| security.txt | **MISSING** | Should provide security contact |

### VULN-010: SPF Uses Soft Fail
**Severity: LOW**

SPF record uses `~all` (soft fail) instead of `-all` (hard fail), allowing spoofed emails to sometimes pass.

**Remediation:** Change to `-all` once mail configuration is verified.

---

## SECTION 5: DEPENDENCY VULNERABILITIES

### VULN-011: Critical Dependency Vulnerabilities
**Severity: HIGH**

`pnpm audit` found 12 vulnerabilities (7 HIGH, 5 MODERATE):

#### HIGH Severity

| Package | Version | Vulnerability | CVE/Advisory |
|---------|---------|---------------|-------------|
| **next** | 15.5.7 | DoS via Server Components | GHSA-mwv6-3258-q52c |
| **next** | 15.5.7 | HTTP deserialization DoS | GHSA-h25m-26qc-wcjf |
| **next** | 15.5.7 | Server Actions source exposure | GHSA-w37m-7fhw-fmv9 |
| **xlsx** | 0.18.5 | Prototype Pollution | GHSA-4r6h-8v6p-xvw6 |
| **xlsx** | 0.18.5 | ReDoS | GHSA-5pgg-2g8v-p4x9 |
| **qs** | 6.14.0 | DoS via memory exhaustion | GHSA-6rw7-vpxm-498p |
| **fast-xml-parser** | 5.2.5 | RangeError DoS | GHSA-37qj-frw5-hhjh |
| **glob** | 10.4.5 | Command injection via CLI | GHSA-5j98-mcp5-4vw2 |

#### MODERATE Severity

| Package | Version | Vulnerability |
|---------|---------|---------------|
| **lodash** | 4.17.21 | Prototype Pollution in unset/omit |
| **body-parser** | 2.2.0 | DoS with url encoding |
| **esbuild** | 0.18.20 | Cross-origin dev server (dev only) |
| **vite** | 4.5.14 | fs.deny bypass on Windows (dev only) |

**Priority Remediation:**
1. **Next.js 15.5.7 -> 15.5.10+** (3 vulnerabilities including source code exposure)
2. **xlsx 0.18.5** -> Consider alternative library (SheetJS has no patched version)
3. **qs/body-parser** -> Update `@bull-board/express` which pulls these
4. **fast-xml-parser** -> Update `@aws-sdk/client-s3` to latest

---

## SECTION 6: CODE-LEVEL VULNERABILITIES (OWASP Top 10)

### VULN-012: Bull Board Dashboard - No Authentication [CRITICAL]
**File:** `src/app/api/admin/bull-board/[...path]/route.ts`

The Bull Board queue management dashboard at `/api/admin/bull-board` has **no authentication**. The middleware passes admin routes through without auth checks.

**Impact:** Unauthenticated access to queue management, job data, ability to pause/resume/delete jobs.

**Remediation:** Add `withAdminAuth()` wrapper or explicit auth check.

---

### VULN-013: Debug Endpoint Exposes User Data [HIGH]
**File:** `src/app/api/b2b/debug/db-connection/route.ts`

Debug endpoint at `/api/b2b/debug/db-connection` exposes B2B users (emails, roles, company names) without authentication.

**Remediation:** Remove in production or gate behind admin auth + environment check.

---

### VULN-014: Weak Default SESSION_SECRET [HIGH]
**File:** `src/lib/auth/b2b-session.ts:11`

```typescript
password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long"
```

Hardcoded fallback allows session forgery if `SESSION_SECRET` env var is not set.

**Remediation:** Remove fallback, throw error if not set.

---

### VULN-015: Weak Default Admin JWT Secret [HIGH]
**File:** `src/lib/auth/admin-auth.ts:11`

```typescript
const JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || "super-admin-secret-change-me"
```

Hardcoded fallback allows admin JWT forgery.

**Remediation:** Remove fallback, throw error if not set.

---

### VULN-016: No Rate Limiting on Login [HIGH]
**File:** `src/app/api/b2b/login/route.ts`

B2B login endpoint has no rate limiting, no progressive delay, no failed attempt logging. Enables brute force attacks.

**Remediation:**
- Max 5 failed attempts per IP per 15 minutes
- Progressive delay after failures
- Account lockout after N failures
- Log failed attempts

---

### VULN-017: No Security Event Logging [HIGH]
**File:** Throughout codebase

Critical security events are not logged: failed auth attempts, access denials, API key failures, admin access.

**Remediation:** Implement centralized security audit logging service.

---

### VULN-018: CDN Test Endpoint - SSRF Risk [MEDIUM]
**File:** `src/app/api/b2b/home-settings/test-cdn/route.ts`

Accepts user-supplied `cdn_url` used directly as S3 endpoint. No URL validation, no auth required on endpoint.

**Remediation:** Validate URL format, whitelist CDN providers, block internal IP ranges, require auth.

---

### VULN-019: Image Remote Patterns Wildcard [MEDIUM]
**File:** `next.config.ts:9-18`

```typescript
{ protocol: "https", hostname: "**" },  // ALL HTTPS domains
{ protocol: "http", hostname: "**" }    // ALL HTTP domains
```

Allows Next.js Image optimization to fetch from any URL (SSRF via image proxy).

**Remediation:** Whitelist specific CDN domains.

---

### VULN-020: TypeScript/ESLint Errors Ignored in Production [MEDIUM]
**File:** `next.config.ts:24-31`

Production builds ignore all TypeScript and ESLint errors, potentially hiding security-relevant type issues.

**Remediation:** Run type checking in CI/CD pipeline, fix errors rather than ignoring.

---

### VULN-021: File Upload Validation Inconsistent [MEDIUM]
**File:** Multiple API endpoints

Different upload endpoints have different validation rules. Some check extension only, not MIME type or magic bytes.

**Remediation:** Centralize file upload validation in shared utility with consistent rules.

---

### VULN-022: Portal User Token Silent Failure [MEDIUM]
**File:** `src/lib/auth/portal-user-token.ts:44-53`

JWT verification silently returns null on ANY failure without logging. Makes it impossible to detect token manipulation.

**Remediation:** Log verification failures, distinguish error types.

---

## SECTION 7: DOCKER SECURITY

### VULN-023: Build-time Secrets Baked into Image [MEDIUM]
**File:** `Dockerfile:27-41`

Sensitive values passed as build ARGs and set as ENV:
- `VINC_MONGO_URL` (contains database credentials)
- `VINC_ANTHROPIC_API_KEY` (API key)

These are visible in image layers (`docker history`, `docker inspect`).

**Positive findings:**
- Non-root user in both runner and worker stages
- Multi-stage build (only production artifacts in final image)
- curl/wget removed from production image
- NEXT_TELEMETRY_DISABLED=1

**Remediation:**
- Use runtime environment variables instead of build-time ARGs for secrets
- Use Docker secrets or external secret manager (Vault, AWS Secrets Manager)
- If ARGs needed at build time, use `--secret` mount: `RUN --mount=type=secret,id=mongo_url ...`

---

## SECTION 8: SECURITY HARDENING CHECKLIST

### Firewall (CRITICAL - DO FIRST)

- [ ] **Block Redis 6379** from public access
- [ ] **Block Solr 8983** from public access
- [ ] **Block MongoDB 27017** from public access
- [ ] **Block PostgreSQL 5432** from public access
- [ ] Allow only ports 22, 80, 443 from public internet
- [ ] Consider restricting SSH to VPN/specific IPs

Example UFW rules:
```bash
# Reset and set default deny
ufw default deny incoming
ufw default allow outgoing

# Allow essential ports only
ufw allow 22/tcp    # SSH (consider restricting to specific IPs)
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS

# Enable firewall
ufw enable
```

### Nginx Hardening

- [ ] Add `server_tokens off;` to hide version
- [ ] Add HSTS header:
  ```nginx
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  ```
- [ ] Add Content-Security-Policy header
- [ ] Verify SSL configuration (use `ssl_protocols TLSv1.2 TLSv1.3;`)
- [ ] Configure rate limiting in nginx:
  ```nginx
  limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
  ```

### Next.js Application

- [ ] Set `poweredByHeader: false` in next.config.ts
- [ ] Remove or restrict `hostname: "**"` in image remotePatterns
- [ ] Fix CORS: replace `*` with explicit origin whitelist
- [ ] Extend security headers to ALL routes (not just API)
- [ ] Add CSP header
- [ ] Remove debug endpoint or gate behind auth + env check

### Authentication & Secrets

- [ ] Remove hardcoded SESSION_SECRET fallback — throw on missing
- [ ] Remove hardcoded SUPER_ADMIN_JWT_SECRET fallback — throw on missing
- [ ] Add rate limiting to `/api/b2b/login`
- [ ] Add rate limiting to `/api/b2b/auth/portal-login`
- [ ] Add authentication to Bull Board dashboard
- [ ] Implement failed login attempt logging

### Redis Security

- [ ] Set `requirepass` in redis.conf
- [ ] Bind to 127.0.0.1 or Docker internal network
- [ ] Upgrade from 6.2.21 to latest 7.x
- [ ] Enable Redis ACLs for least-privilege access
- [ ] Disable dangerous commands: `rename-command FLUSHALL ""`

### MongoDB Security

- [ ] Ensure authentication is enabled
- [ ] Bind to 127.0.0.1 or Docker internal network
- [ ] Use strong, unique passwords per tenant
- [ ] Enable audit logging
- [ ] Enable TLS for connections

### Solr Security

- [ ] Enable Solr authentication plugin
- [ ] Bind to Docker internal network only
- [ ] Use nginx reverse proxy with auth for admin access
- [ ] Enable audit logging

### SSH Hardening

- [ ] Disable password authentication: `PasswordAuthentication no`
- [ ] Disable root login: `PermitRootLogin no`
- [ ] Use ed25519 keys: `ssh-keygen -t ed25519`
- [ ] Install and configure fail2ban
- [ ] Consider port knocking or non-standard port

### Dependencies

- [ ] Update Next.js to 15.5.10+
- [ ] Replace xlsx with safer alternative (e.g., ExcelJS)
- [ ] Update @aws-sdk packages (fast-xml-parser fix)
- [ ] Update @bull-board/express (qs/body-parser fixes)
- [ ] Set up automated dependency scanning (Dependabot/Renovate)
- [ ] Run `pnpm audit` in CI/CD pipeline

### Docker

- [ ] Move secrets from build ARGs to runtime env vars
- [ ] Use Docker secrets for sensitive values
- [ ] Pin base image versions (not just `node:20-alpine`)
- [ ] Scan images with Trivy in CI/CD

### Monitoring & Logging

- [ ] Implement centralized security event logging
- [ ] Set up alerts for: failed logins, admin access, API errors
- [ ] Monitor certificate expiration (expires Mar 15, 2026)
- [ ] Set up uptime monitoring for all services
- [ ] Review and remove console.log statements with sensitive data

### DNS & Email

- [ ] Change SPF from `~all` to `-all`
- [ ] Add DMARC record
- [ ] Add DKIM record
- [ ] Create `/.well-known/security.txt` with security contact
- [ ] Fix robots.txt sitemap URL (points to demo.vinc.trade)

---

## Risk Matrix

| # | Vulnerability | Severity | Exploitability | Impact | Priority |
|---|--------------|----------|---------------|--------|----------|
| 001 | Redis open (no auth) | CRITICAL | Trivial | Total data loss | **P0 - NOW** |
| 002 | Solr open (no auth) | CRITICAL | Trivial | Data leak/deletion | **P0 - NOW** |
| 003 | MongoDB open | CRITICAL | Easy | Full DB access | **P0 - NOW** |
| 004 | PostgreSQL open | CRITICAL | Easy | DB access | **P0 - NOW** |
| 012 | Bull Board no auth | CRITICAL | Easy | Job manipulation | **P0 - NOW** |
| 009 | CORS wildcard | HIGH | Medium | CSRF attacks | **P1 - This week** |
| 011 | Next.js CVEs | HIGH | Medium | DoS/Info leak | **P1 - This week** |
| 013 | Debug endpoint exposed | HIGH | Easy | Data exposure | **P1 - This week** |
| 014 | Weak session secret | HIGH | Medium | Session forgery | **P1 - This week** |
| 015 | Weak admin JWT | HIGH | Medium | Admin impersonation | **P1 - This week** |
| 016 | No login rate limit | HIGH | Easy | Brute force | **P1 - This week** |
| 017 | No security logging | HIGH | N/A | Blind to attacks | **P1 - This week** |
| 007 | Missing security headers | MEDIUM | Low | Various | P2 - This sprint |
| 018-022 | Code-level issues | MEDIUM | Various | Various | P2 - This sprint |
| 023 | Docker secrets in layers | MEDIUM | Medium | Credential leak | P2 - This sprint |

---

## Methodology

**Tools used:**
- `curl` - HTTP header analysis, path probing
- `openssl s_client` - TLS version and cipher testing
- `dig` - DNS reconnaissance
- `nc` (netcat) - Service probing
- `bash /dev/tcp` - Port scanning (nmap not available)
- `pnpm audit` - Dependency vulnerability scanning
- Manual code review - OWASP Top 10 analysis

**Tools NOT available (recommended for follow-up):**
- nmap (comprehensive port/service scan)
- OWASP ZAP (automated web vulnerability scanner)
- Trivy (Docker image vulnerability scanner)
- nikto (web server scanner)
- testssl.sh (comprehensive TLS testing)

**Recommended follow-up:** Install and run OWASP ZAP for automated web vulnerability scanning, and Trivy for Docker image scanning.
