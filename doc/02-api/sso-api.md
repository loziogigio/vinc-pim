# SSO Authentication API

Single Sign-On (SSO) authentication system for VINC Commerce Suite. Provides centralized authentication via VINC API with session management, rate limiting, and OAuth 2.0 support.

## Overview

The SSO system authenticates users against the VINC API service and manages sessions locally. It supports:

- **Direct Login** - Simple token-based authentication
- **OAuth 2.0 Flow** - Authorization code flow with PKCE support
- **Session Management** - Device tracking, session revocation
- **Rate Limiting** - Progressive delays, account lockout protection
- **Multi-tenant** - Per-tenant authentication isolation

## Authentication Flow

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Client    │         │ Commerce Suite   │         │  VINC API   │
│   (B2B)     │         │   SSO Service    │         │   Service   │
└──────┬──────┘         └────────┬─────────┘         └──────┬──────┘
       │                         │                          │
       │ 1. POST /api/auth/login │                          │
       │ (email, password,       │                          │
       │  tenant_id)             │                          │
       │────────────────────────>│                          │
       │                         │                          │
       │                         │ 2. POST /auth/login      │
       │                         │────────────────────────>│
       │                         │                          │
       │                         │ 3. tokens                │
       │                         │<────────────────────────│
       │                         │                          │
       │                         │ 4. GET /auth/me          │
       │                         │────────────────────────>│
       │                         │                          │
       │                         │ 5. user profile          │
       │                         │<────────────────────────│
       │                         │                          │
       │ 6. SSO tokens +         │                          │
       │    user profile +       │                          │
       │    session_id           │                          │
       │<────────────────────────│                          │
       │                         │                          │
```

## Endpoints

### POST /api/auth/login

Authenticate user credentials and create a session.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "tenant_id": "hidros-it",

  // Optional: OAuth flow parameters
  "client_id": "vinc-b2b",
  "redirect_uri": "https://b2b.example.com/callback",
  "response_type": "code",
  "state": "random-state-string",
  "code_challenge": "challenge-string",
  "code_challenge_method": "S256"
}
```

**Response (Direct Login):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "A5cSTDbHsOGII0HTSrlIcV...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "973058c3-68b7-4bef-b955-c882b72b7324",
    "email": "user@example.com",
    "name": "Mario Rossi",
    "role": "reseller",
    "supplier_id": "eaef75b6-4095-4efc-bdbc-b41ea469a265",
    "supplier_name": "Hidros Point Srl",
    "customers": [
      {
        "id": "fa6bb051-0908-433b-ad6a-3d0b5da1e25e",
        "erp_customer_id": "026269",
        "name": "PALUMBO SALVATORE",
        "business_name": "Palumbo Srl",
        "addresses": [
          {
            "id": "8265d7f9-a975-4717-aba9-8d3d5ba60eab",
            "erp_address_id": "000000",
            "label": "POMIGLIANO DARCO (NA)",
            "pricelist_code": "02"
          }
        ]
      }
    ],
    "has_password": true
  },
  "tenant_id": "hidros-it",
  "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89",
  "vinc_tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**Response (OAuth Flow):**

```json
{
  "redirect_uri": "https://b2b.example.com/callback",
  "code": "auth-code-123",
  "state": "random-state-string"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Password is required` | Missing password field |
| 400 | `Email or username is required` | Missing identifier |
| 400 | `Tenant ID is required` | Missing tenant_id |
| 400 | `client_id and redirect_uri are required for OAuth flow` | OAuth params missing |
| 401 | `Invalid credentials` | Wrong email/password |
| 429 | `Account temporarily locked` | Too many failed attempts |
| 429 | `Too many requests from this IP` | Global rate limit |
| 503 | `Authentication service error` | VINC API unavailable |

---

### GET /api/auth/validate

Validate an access token and get user info.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "authenticated": true,
  "user": {
    "id": "973058c3-68b7-4bef-b955-c882b72b7324",
    "email": "user@example.com",
    "role": "reseller"
  },
  "tenant_id": "hidros-it",
  "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89",
  "expires_at": "2026-01-25T09:39:49.000Z"
}
```

**Invalid Token Response:**

```json
{
  "authenticated": false
}
```

---

### POST /api/auth/validate

RFC 7662 compliant token introspection.

**Headers:**

```
Authorization: Bearer <access_token>
```

Or in body:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**Response:**

```json
{
  "active": true,
  "token_type": "Bearer",
  "client_id": "vinc-commerce-suite",
  "username": "user@example.com",
  "sub": "973058c3-68b7-4bef-b955-c882b72b7324",
  "tenant_id": "hidros-it",
  "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89",
  "email": "user@example.com",
  "role": "reseller",
  "exp": 1769333989,
  "iat": 1769333089,
  "jti": "a80e4401-813f-4554-b09d-5971e67c93a0",
  "device_type": "desktop",
  "browser": "Chrome",
  "os": "Windows",
  "ip_address": "192.168.1.100"
}
```

---

### POST /api/auth/refresh

Refresh an expired access token.

**Request Body:**

```json
{
  "refresh_token": "A5cSTDbHsOGII0HTSrlIcV..."
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "B6dTUEcIsOHJJ1IUSsmJdW...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Refresh token is required` | Missing token |
| 401 | `Invalid or expired refresh token` | Token invalid |
| 401 | `Session expired or revoked` | Session ended |

---

### POST /api/auth/logout

End a user session.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body (optional):**

```json
{
  "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89",
  "all_sessions": false,
  "redirect_uri": "https://example.com/logged-out"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | End specific session (optional if token provided) |
| `all_sessions` | boolean | End all user sessions across devices |
| `redirect_uri` | string | URL to redirect after logout |

**Response:**

```json
{
  "success": true,
  "sessions_ended": 1,
  "redirect_uri": "https://example.com/logged-out"
}
```

---

### GET /api/auth/logout

Browser-based logout with redirect.

**Query Parameters:**

```
GET /api/auth/logout?session_id=xxx&redirect_uri=https://example.com
```

**Response:**

- If `redirect_uri` provided: HTTP 302 redirect
- Otherwise: `{ "success": true }`

---

### POST /api/auth/change-password

Change password for authenticated user. Sends confirmation email on success.

**Headers:**

```
Authorization: Bearer <sso_access_token>
```

**Request Body:**

```json
{
  "currentPassword": "oldpassword123",
  "password": "newpassword456",
  "vinc_access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentPassword` | string | Yes | Current password |
| `password` | string | Yes | New password (alias: `newPassword`) |
| `vinc_access_token` | string | Yes | VINC API access token from login response |
| `username` / `email` | string | No | Email for confirmation notification |

**Response:**

```json
{
  "success": true,
  "message": "Password cambiata con successo"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Current password is required` | Missing currentPassword field |
| 400 | `New password is required` | Missing password field |
| 400 | `VINC access token is required` | Missing vinc_access_token |
| 401 | `Authentication required` | No SSO Bearer token provided |
| 401 | `Invalid or expired token` | SSO token validation failed |
| 401 | `La password attuale non è corretta` | Wrong current password |
| 401 | `Session expired or revoked` | Session no longer valid |
| 500 | `Si è verificato un errore` | Server error |

---

### POST /api/auth/reset-password

Reset password by email (forgot password flow). No authentication required.

- If `password` is provided: sets the password directly
- If `password` is not provided: generates temporary password and sends email

**Request Body:**

```json
{
  "email": "user@example.com",
  "tenant_id": "hidros-it",

  // Optional: Set specific password (otherwise generates temp)
  "password": "newpassword123",

  // Optional: Customer info for email personalization
  "ragioneSociale": "Azienda Srl",
  "contactName": "Mario Rossi"
}
```

**Response (Temp Password Generated):**

```json
{
  "success": true,
  "message": "Email di recupero inviata"
}
```

**Response (Password Provided):**

```json
{
  "success": true,
  "message": "Password reimpostata con successo"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Email is required` | Missing email/username field |
| 400 | `Tenant ID is required` | Missing tenant_id |
| 404 | `Utente non trovato` | User not found in VINC API |
| 400 | Various | VINC API validation errors |
| 500 | `Si è verificato un errore` | Server error |

---

### POST /api/b2b/addresses

Get customer shipping addresses. Proxies to VINC API and transforms response.

**Request Body:**

```json
{
  "customer_id": "026269",
  "tenant_id": "hidros-it"
}
```

**Response:**

```json
{
  "success": true,
  "addresses": [
    {
      "id": "000000",
      "title": "Via Roma 123 - Milano",
      "isLegalSeat": false,
      "isDefault": true,
      "address": {
        "street_address": "Via Roma 123",
        "city": "Milano",
        "state": "MI",
        "zip": "20100",
        "country": "IT"
      },
      "contact": {
        "phone": "+39 02 1234567",
        "email": "info@example.com"
      },
      "paymentTerms": {
        "code": "30GG"
      }
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Customer ID is required` | Missing customer_id |
| 400 | `Tenant ID is required` | Missing tenant_id |
| 404 | `Customer not found` | Customer not in VINC API |
| 500 | `An error occurred` | Server error |

---

### POST /api/auth/token

OAuth 2.0 token exchange (authorization code → tokens).

**Request Body:**

```json
{
  "grant_type": "authorization_code",
  "code": "auth-code-123",
  "redirect_uri": "https://b2b.example.com/callback",
  "client_id": "vinc-b2b",
  "client_secret": "secret-key",
  "code_verifier": "pkce-verifier-string"
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "A5cSTDbHsOGII0HTSrlIcV...",
  "token_type": "Bearer",
  "expires_in": 900,
  "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89"
}
```

---

## Token Structure

### Access Token (JWT)

```json
{
  "sub": "973058c3-68b7-4bef-b955-c882b72b7324",
  "tenant_id": "hidros-it",
  "email": "user@example.com",
  "role": "reseller",
  "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89",
  "client_id": "vinc-commerce-suite",
  "jti": "a80e4401-813f-4554-b09d-5971e67c93a0",
  "iat": 1769333089,
  "exp": 1769333989
}
```

| Field | Description |
|-------|-------------|
| `sub` | User ID (UUID from VINC API) |
| `tenant_id` | Tenant identifier |
| `email` | User email |
| `role` | User role (admin, reseller, etc.) |
| `session_id` | Active session identifier |
| `client_id` | Client application ID |
| `jti` | Unique token identifier |
| `iat` | Issued at (Unix timestamp) |
| `exp` | Expiration (Unix timestamp) |

### Token Lifetimes

| Token | Lifetime |
|-------|----------|
| Access Token | 15 minutes |
| Refresh Token | 7 days |
| Authorization Code | 5 minutes |

---

## Rate Limiting

The SSO system implements progressive rate limiting:

### Per-User Limits

| Failed Attempts | Action |
|-----------------|--------|
| 1-3 | No delay |
| 4-5 | 1 second delay |
| 6-7 | 5 second delay |
| 8-9 | 15 second delay |
| 10+ | Account locked for 15 minutes |

### Global IP Limits

- 100 requests per IP per minute
- 1000 requests per IP per hour

### Rate Limit Response

```json
{
  "error": "Account temporarily locked",
  "lockout_until": "2026-01-25T12:15:00.000Z",
  "attempts_remaining": 0
}
```

---

## Session Management

Sessions track:

- Device type (desktop, mobile, tablet)
- Browser and version
- Operating system
- IP address
- Geographic location (country, city)
- Last activity timestamp

### Session Data Model

```typescript
interface SSOSession {
  session_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  company_name?: string;

  // Client info
  client_app: "vinc-b2b" | "vinc-vetrina" | "vinc-pim" | "vinc-commerce-suite" | "vinc-mobile";

  // Device tracking
  ip_address: string;
  country?: string;
  city?: string;
  device_type: "desktop" | "mobile" | "tablet" | "unknown";
  browser?: string;
  os?: string;
  user_agent?: string;

  // Timestamps
  created_at: Date;
  last_activity: Date;
  expires_at: Date;

  // Status
  is_active: boolean;
  revoked_at?: Date;
  revoked_reason?: string;
}
```

---

## Configuration

### Environment Variables

```bash
# VINC API Configuration (Required)
VINC_API_URL=http://149.81.163.109:8005
VINC_INTERNAL_API_KEY=your-api-key-here

# Session Settings (Optional)
SSO_ACCESS_TOKEN_EXPIRY=900          # 15 minutes
SSO_REFRESH_TOKEN_EXPIRY=604800      # 7 days
SSO_AUTH_CODE_EXPIRY=300             # 5 minutes

# Rate Limiting (Optional)
SSO_MAX_FAILED_ATTEMPTS=10
SSO_LOCKOUT_DURATION=900             # 15 minutes
```

---

## Client Integration Examples

### JavaScript/TypeScript

```typescript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    tenant_id: 'hidros-it'
  })
});

const { access_token, refresh_token, user } = await response.json();

// Store tokens
sessionStorage.setItem('access_token', access_token);
sessionStorage.setItem('refresh_token', refresh_token);

// Use token for authenticated requests
const data = await fetch('/api/b2b/products', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

// Refresh token when expired
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token })
});

const newTokens = await refreshResponse.json();
```

### React Hook Example

```typescript
import { useState, useCallback, useEffect } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  const login = useCallback(async (email: string, password: string, tenantId: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenant_id: tenantId })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }

    const data = await res.json();
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('refresh_token', data.refresh_token);

    setState({
      isAuthenticated: true,
      user: data.user,
      loading: false
    });

    return data;
  }, []);

  const logout = useCallback(async () => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');

    setState({
      isAuthenticated: false,
      user: null,
      loading: false
    });
  }, []);

  const validateToken = useCallback(async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setState({ isAuthenticated: false, user: null, loading: false });
      return;
    }

    const res = await fetch('/api/auth/validate', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    setState({
      isAuthenticated: data.authenticated,
      user: data.authenticated ? data.user : null,
      loading: false
    });
  }, []);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  return { ...state, login, logout, validateToken };
}
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123","tenant_id":"hidros-it"}'

# Validate token
curl http://localhost:3001/api/auth/validate \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."

# Refresh token
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"A5cSTDbHsOGII0HTSrlIcV..."}'

# Logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."

# Logout all sessions
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
  -H "Content-Type: application/json" \
  -d '{"all_sessions":true}'
```

---

## Login Page

The centralized SSO login page for all VINC applications.

### URL

```
/auth/login
```

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `tenant_id` | No* | Tenant identifier (e.g., `hidros-it`). If not provided, user must enter it. |
| `client_id` | No | OAuth client ID (e.g., `vinc-b2b`). Shows which app is requesting access. |
| `redirect_uri` | No | Where to redirect after successful login |
| `state` | No | OAuth state parameter for CSRF protection |
| `prompt` | No | Set to `none` for silent SSO (skip form if already authenticated) |
| `code_challenge` | No | PKCE code challenge for OAuth flow |
| `code_challenge_method` | No | PKCE method: `plain` or `S256` |
| `error` | No | Error code to display |
| `error_description` | No | Error message to display |

*Required for authentication, but can be entered in the form if not in URL.

### Tenant Branding

When `tenant_id` is provided in the URL, the login page automatically fetches and displays tenant branding from home settings:

| Element | Source | Fallback |
|---------|--------|----------|
| **Logo** | `branding.logo` | "V" icon |
| **Title** | `branding.title` | "VINC Commerce Suite" |
| **Website Link** | `branding.websiteUrl` | Hidden if not set |
| **Shop Link** | `branding.shopUrl` | Hidden if not set |

**Behavior:**

- **With `tenant_id`**: Tenant field is locked (read-only), shows company name and tenant ID
- **Without `tenant_id`**: Tenant field is editable, user must enter tenant ID manually

### Branding API

Public endpoint to fetch tenant branding (no authentication required):

```
GET /api/auth/tenant-branding?tenant_id=hidros-it
```

**Response:**

```json
{
  "tenant_id": "hidros-it",
  "branding": {
    "title": "Hidros S.r.l",
    "logo": "https://cdn.example.com/logos/hidros.png",
    "favicon": "https://cdn.example.com/favicon/hidros.ico",
    "primaryColor": "#009688",
    "shopUrl": "https://shop.hidros.com",
    "websiteUrl": "https://www.hidros.com"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `tenant_id is required` | Missing tenant_id parameter |
| 400 | `Invalid tenant_id format` | Invalid characters in tenant_id |
| 404 | `Tenant not found` | No home settings for tenant |

### Direct Login URL Examples

```bash
# Basic login (user enters tenant)
/auth/login

# Pre-filled tenant with branding
/auth/login?tenant_id=hidros-it

# From external app with redirect
/auth/login?tenant_id=hidros-it&redirect_uri=https://b2b.example.com/dashboard

# Show error message
/auth/login?error=session_expired&error_description=Your+session+has+expired
```

### Supported OAuth Clients

| Client ID | Application |
|-----------|-------------|
| `vinc-b2b` | VINC B2B Portal |
| `vinc-vetrina` | VINC Vetrina |
| `vinc-commerce-suite` | VINC Commerce Suite |
| `vinc-mobile` | VINC Mobile App |
| `vinc-pim` | VINC PIM |

---

## OAuth 2.0 Flow

For client applications that need OAuth authorization code flow:

### 1. Redirect to Login

```
https://commerce-suite.example.com/auth/login
  ?client_id=vinc-b2b
  &redirect_uri=https://b2b.example.com/callback
  &response_type=code
  &state=random-state-123
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

### 2. User Authenticates

User enters credentials on the login page.

### 3. Redirect Back with Code

```
https://b2b.example.com/callback
  ?code=auth-code-123
  &state=random-state-123
```

### 4. Exchange Code for Tokens

```bash
curl -X POST https://commerce-suite.example.com/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "auth-code-123",
    "redirect_uri": "https://b2b.example.com/callback",
    "client_id": "vinc-b2b",
    "client_secret": "your-client-secret",
    "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  }'
```

---

## OAuth Clients

OAuth clients are registered applications that can authenticate users via the SSO system.

### Client Architecture

OAuth clients are **global** (stored in `vinc-admin` database) and shared across all tenants. However, **redirect URI validation is per-tenant** based on the tenant's domain configuration.

```
┌───────────────────────────────────────────────────────────┐
│                    vinc-admin database                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              OAuth Clients (Global)                  │  │
│  │  - vinc-b2b                                          │  │
│  │  - vinc-vetrina                                      │  │
│  │  - vinc-commerce-suite                               │  │
│  │  - vinc-mobile                                       │  │
│  │  - vinc-pim                                          │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │     Per-Tenant Redirect Validation   │
            │  ┌─────────────┐  ┌─────────────┐   │
            │  │  hidros-it  │  │  other-it   │   │
            │  │  domains    │  │  domains    │   │
            │  └─────────────┘  └─────────────┘   │
            └─────────────────────────────────────┘
```

### Auto-Seeding

OAuth clients are **automatically seeded** on first use. When the first login request is made and no clients exist in the database, the system automatically creates the default first-party clients.

No manual seeding required - the system handles this transparently.

### Registered Clients

| Client ID | Name | Type | Description |
|-----------|------|------|-------------|
| `vinc-b2b` | VINC B2B Portal | web | B2B e-commerce portal for suppliers and retailers |
| `vinc-vetrina` | VINC Vetrina | web | Public storefront for retailers |
| `vinc-commerce-suite` | VINC Commerce Suite | web | Main commerce suite admin panel |
| `vinc-mobile` | VINC Mobile App | mobile | Native mobile application for iOS and Android |
| `vinc-pim` | VINC PIM | web | Product Information Management system |

### Creating Custom Clients

For third-party integrations, create custom OAuth clients via the API:

```bash
# Admin-only endpoint (requires superadmin auth)
POST /api/admin/oauth/clients

{
  "client_id": "partner-app",
  "name": "Partner Application",
  "redirect_uris": ["https://partner.example.com/callback"],
  "type": "web",
  "description": "Third-party integration"
}
```

---

## Redirect URI Validation

Redirect URIs are validated **per-tenant** against the tenant's configuration. This ensures that OAuth redirects only go to authorized domains for each tenant.

### Validation Sources

The system checks redirect URIs against these sources (in order):

| Priority | Source | Example |
|----------|--------|---------|
| 1 | **Localhost** (always allowed) | `http://localhost:3000/callback` |
| 2 | **Tenant domains** (from superadmin) | `https://shop.hidros.com/callback` |
| 3 | **Branding URLs** (from home-settings) | `https://b2b.hidros.com/callback` |

### Tenant Domains (Superadmin)

Domains configured in the Multi-Tenant Configuration (superadmin section):

```json
{
  "tenant_id": "hidros-it",
  "domains": [
    {
      "hostname": "shop.hidros.com",
      "protocol": "https",
      "is_active": true
    },
    {
      "hostname": "admin.hidros.com",
      "protocol": "https",
      "is_active": true
    }
  ]
}
```

**Valid redirects:**

- `https://shop.hidros.com/callback` ✓
- `https://shop.hidros.com/api/auth/callback` ✓
- `https://admin.hidros.com/callback` ✓

### Branding URLs (Home Settings)

URLs configured in the tenant's home settings branding:

```json
{
  "branding": {
    "shopUrl": "https://b2b.hidros.com",
    "websiteUrl": "https://www.hidros.com"
  }
}
```

**Valid redirects:**

- `https://b2b.hidros.com/callback` ✓
- `https://b2b.hidros.com/api/auth/callback` ✓
- `https://www.hidros.com/callback` ✓

### Localhost (Development)

Localhost URLs are always allowed for development purposes:

- `http://localhost:3000/callback` ✓
- `http://localhost:3001/api/auth/callback` ✓
- `http://127.0.0.1:3000/callback` ✓

### Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Redirect URI Validation                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │  Is localhost?   │
                   └────────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              │ Yes         │             │ No
              ▼             │             ▼
         ┌────────┐         │    ┌────────────────────┐
         │ ALLOW  │         │    │  Check tenant      │
         └────────┘         │    │  domains           │
                            │    └─────────┬──────────┘
                            │              │
                            │    ┌─────────┼─────────────┐
                            │    │ Match   │             │ No match
                            │    ▼         │             ▼
                            │ ┌────────┐   │    ┌────────────────────┐
                            │ │ ALLOW  │   │    │  Check branding    │
                            │ └────────┘   │    │  URLs              │
                            │              │    └─────────┬──────────┘
                            │              │              │
                            │              │    ┌─────────┼─────────┐
                            │              │    │ Match   │         │ No match
                            │              │    ▼         │         ▼
                            │              │ ┌────────┐   │    ┌────────┐
                            │              │ │ ALLOW  │   │    │ DENY   │
                            │              │ └────────┘   │    └────────┘
```

### Error Response

If redirect URI validation fails:

```json
{
  "error": "Invalid client_id or redirect_uri"
}
```

**Common causes:**

- Redirect URI origin doesn't match any tenant domain
- Domain is configured but `is_active: false`
- Branding URLs not configured for the tenant
- Typo in the redirect URI

---

## Security Considerations

1. **Token Storage** - Store access tokens in `sessionStorage`, never `localStorage`
2. **HTTPS** - Always use HTTPS in production
3. **Token Refresh** - Implement automatic token refresh before expiration
4. **Logout** - Always call logout endpoint to properly revoke sessions
5. **PKCE** - Use PKCE for OAuth flows to prevent authorization code interception
6. **Rate Limiting** - Handle 429 responses gracefully with retry logic

---

## Related Documentation

- [Portal Users API](./portal-users-api.md) - Customer portal authentication
- [Multi-tenant Architecture](../06-architecture/MULTI_TENANT.md) - Tenant isolation
