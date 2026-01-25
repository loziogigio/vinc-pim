# VINC API Client

Internal client for service-to-service communication between VINC Commerce Suite and VINC API (Python backend).

## Overview

The VINC API Client enables the Commerce Suite to communicate with the VINC API backend for:

- **Authentication** - Login, profile, password management
- **B2B Operations** - Customer data, addresses

All requests use the `X-Internal-API-Key` header for service authentication (no JWT required for the service itself).

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  VINC Commerce Suite    │         │      VINC API           │
│  (Next.js)              │         │      (Python/FastAPI)   │
│                         │         │                         │
│  ┌──────────────────┐   │         │  ┌──────────────────┐   │
│  │ VincApiClient    │───┼────────▶│  │ /api/v1/internal │   │
│  │                  │   │  HTTP   │  │                  │   │
│  │ - auth.login()   │   │         │  │ - /auth/login    │   │
│  │ - auth.getProfile│   │         │  │ - /auth/me       │   │
│  │ - b2b.getAddresses│  │         │  │ - /b2b/customers │   │
│  └──────────────────┘   │         │  └──────────────────┘   │
└─────────────────────────┘         └─────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# VINC API URL (Required)
VINC_API_URL=http://149.81.163.109:8005

# Internal API Key for service-to-service auth (Required)
VINC_INTERNAL_API_KEY=your-internal-api-key-here
```

### Usage

```typescript
import { getVincApiForTenant } from "@/lib/vinc-api";

// Get client for a tenant
const vincApi = getVincApiForTenant("hidros-it");

// Or with custom config
const vincApi = getVincApiForTenant({
  tenantId: "hidros-it",
  vincApiUrl: "http://custom-api.example.com",
  vincApiKey: "custom-api-key",
});
```

---

## Authentication Methods

### `auth.login(credentials)`

Authenticate user with email and password.

```typescript
const vincApi = getVincApiForTenant("hidros-it");

const tokens = await vincApi.auth.login({
  email: "user@example.com",
  password: "password123",
});

console.log(tokens);
// {
//   access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   token_type: "Bearer",
//   expires_in: 3600
// }
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `password` | string | Yes | User password |

**Returns:** `AuthLoginResponse`

| Field | Type | Description |
|-------|------|-------------|
| `access_token` | string | JWT access token |
| `refresh_token` | string | JWT refresh token |
| `token_type` | string | Always "Bearer" |
| `expires_in` | number | Token lifetime in seconds |

---

### `auth.getProfile(accessToken)`

Get user profile using their access token.

```typescript
const profile = await vincApi.auth.getProfile(tokens.access_token);

console.log(profile);
// {
//   id: "973058c3-68b7-4bef-b955-c882b72b7324",
//   email: "user@example.com",
//   name: "Mario Rossi",
//   role: "reseller",
//   status: "active",
//   supplier_id: "eaef75b6-4095-4efc-bdbc-b41ea469a265",
//   supplier_name: "Hidros Point Srl",
//   customers: [
//     {
//       id: "fa6bb051-0908-433b-ad6a-3d0b5da1e25e",
//       erp_customer_id: "026269",
//       name: "PALUMBO SALVATORE",
//       business_name: "Palumbo Srl",
//       addresses: [
//         {
//           id: "8265d7f9-a975-4717-aba9-8d3d5ba60eab",
//           erp_address_id: "000000",
//           label: "POMIGLIANO DARCO (NA)",
//           pricelist_code: "02"
//         }
//       ]
//     }
//   ],
//   has_password: true
// }
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accessToken` | string | Yes | User's VINC API access token |

**Returns:** `AuthProfileResponse`

---

### `auth.changePassword(accessToken, currentPassword, newPassword)`

Change password for an authenticated user.

```typescript
const result = await vincApi.auth.changePassword(
  tokens.access_token,
  "oldPassword123",
  "newPassword456"
);

// { success: true, message: "Password changed successfully" }
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accessToken` | string | Yes | User's VINC API access token |
| `currentPassword` | string | Yes | Current password |
| `newPassword` | string | Yes | New password |

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `La password attuale non è corretta` | Wrong current password |
| 400 | Validation error | Password doesn't meet requirements |

---

### `auth.setPasswordByEmail(email, password)`

Set/reset password for a user by email (admin operation).

```typescript
const result = await vincApi.auth.setPasswordByEmail(
  "user@example.com",
  "newPassword123"
);

// { success: true }
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `password` | string | Yes | New password to set |

**Use case:** Password reset flow (forgot password).

---

### `auth.refreshToken(refreshToken)`

Refresh an expired access token.

```typescript
const newTokens = await vincApi.auth.refreshToken(tokens.refresh_token);

// {
//   access_token: "new-access-token...",
//   refresh_token: "new-refresh-token...",
//   token_type: "Bearer",
//   expires_in: 3600
// }
```

---

### `auth.logout(accessToken)`

Invalidate a user's token on the backend.

```typescript
const result = await vincApi.auth.logout(tokens.access_token);

// { success: true }
```

---

## B2B Methods

### `b2b.getCustomer(customerId)`

Get B2B customer details by ID.

```typescript
const customer = await vincApi.b2b.getCustomer("026269");

console.log(customer);
// {
//   id: "fa6bb051-0908-433b-ad6a-3d0b5da1e25e",
//   erp_customer_id: "026269",
//   name: "PALUMBO SALVATORE",
//   business_name: "Palumbo Srl",
//   vat_number: "IT12345678901",
//   fiscal_code: "PLMSLS80A01F839X",
//   email: "info@palumbo.it",
//   phone: "+39 081 123456",
//   is_active: true,
//   created_at: "2024-01-15T10:30:00Z",
//   updated_at: "2024-06-20T14:45:00Z"
// }
```

---

### `b2b.getAddresses(customerId)`

Get all addresses for a B2B customer.

```typescript
const addresses = await vincApi.b2b.getAddresses("026269");

console.log(addresses);
// [
//   {
//     id: "8265d7f9-a975-4717-aba9-8d3d5ba60eab",
//     erp_address_id: "000000",
//     customer_id: "026269",
//     label: "Sede Legale",
//     street: "Via Roma 123",
//     city: "Milano",
//     zip: "20100",
//     province: "MI",
//     country: "IT",
//     phone: "+39 02 1234567",
//     email: "info@palumbo.it",
//     pricelist_code: "02",
//     payment_terms_code: "30GG",
//     is_default: true,
//     is_active: true,
//     created_at: "2024-01-15T10:30:00Z",
//     updated_at: "2024-06-20T14:45:00Z"
//   },
//   {
//     id: "9376e8a0-1019-544c-be7b-4e1c6eb2f36f",
//     erp_address_id: "000001",
//     customer_id: "026269",
//     label: "Magazzino Nord",
//     street: "Via Industria 45",
//     city: "Torino",
//     zip: "10100",
//     province: "TO",
//     country: "IT",
//     is_default: false,
//     is_active: true
//   }
// ]
```

---

### `b2b.getAddress(customerId, addressId)`

Get a specific address for a customer.

```typescript
const address = await vincApi.b2b.getAddress("026269", "000000");

// Single B2BAddress object
```

---

## Error Handling

The client throws `VincApiError` for failed requests:

```typescript
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";

try {
  const vincApi = getVincApiForTenant("hidros-it");
  const profile = await vincApi.auth.getProfile(accessToken);
} catch (error) {
  if (error instanceof VincApiError) {
    console.error("VINC API Error:", error.status, error.detail);

    switch (error.status) {
      case 401:
        // Invalid credentials or expired token
        break;
      case 404:
        // Resource not found
        break;
      case 400:
        // Validation error
        break;
      case 500:
        // Server error
        break;
    }
  }
  throw error;
}
```

### VincApiError Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | number | HTTP status code |
| `detail` | string | Error message from API |
| `name` | string | Always "VincApiError" |

---

## Internal API Headers

All requests include these headers:

| Header | Value | Description |
|--------|-------|-------------|
| `X-Internal-API-Key` | `{apiKey}` | Service authentication key |
| `X-Tenant-ID` | `{tenantId}` | Tenant identifier |
| `X-Service-Name` | `vinc-commerce-suite` | Calling service name |
| `Content-Type` | `application/json` | Request content type |

For user-authenticated endpoints (getProfile, changePassword), also includes:

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer {accessToken}` | User's JWT token |

---

## API Route Examples

### Password Reset Route

```typescript
// src/app/api/auth/reset-password/route.ts
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";
import { sendForgotPasswordNotification } from "@/lib/notifications/send.service";

export async function POST(req: NextRequest) {
  const { email, tenant_id, password } = await req.json();

  const vincApi = getVincApiForTenant(tenant_id);
  const tenantDb = `vinc-${tenant_id}`;

  // Generate temp password if not provided
  const tempPassword = password || generateTempPassword();

  try {
    // Set password via VINC API
    await vincApi.auth.setPasswordByEmail(email, tempPassword);

    // Send notification email (if temp password)
    if (!password) {
      await sendForgotPasswordNotification(tenantDb, email, {
        customer_name: "Cliente",
        temporary_password: tempPassword,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof VincApiError) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Utente non trovato" },
          { status: 404 }
        );
      }
    }
    throw error;
  }
}
```

### Get Customer Addresses Route

```typescript
// src/app/api/b2b/addresses/route.ts
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";

export async function POST(req: NextRequest) {
  const { customer_id, tenant_id } = await req.json();

  const vincApi = getVincApiForTenant(tenant_id);

  try {
    const addresses = await vincApi.b2b.getAddresses(customer_id);

    // Transform to UI-friendly format
    return NextResponse.json({
      success: true,
      addresses: addresses.map((addr) => ({
        id: addr.erp_address_id,
        title: `${addr.street} - ${addr.city}`,
        isDefault: addr.is_default,
        address: {
          street_address: addr.street,
          city: addr.city,
          state: addr.province,
          zip: addr.zip,
          country: addr.country,
        },
        contact: {
          phone: addr.phone,
          email: addr.email,
        },
        paymentTerms: {
          code: addr.payment_terms_code,
        },
      })),
    });
  } catch (error) {
    if (error instanceof VincApiError) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
    }
    throw error;
  }
}
```

---

## Type Definitions

### AuthLoginRequest

```typescript
interface AuthLoginRequest {
  email: string;
  password: string;
}
```

### AuthLoginResponse

```typescript
interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
```

### AuthProfileResponse

```typescript
interface AuthProfileResponse {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  supplier_id?: string;
  supplier_name?: string;
  customers: AuthProfileCustomer[];
  has_password: boolean;
}

interface AuthProfileCustomer {
  id: string;
  erp_customer_id: string;
  name?: string;
  business_name?: string;
  addresses: AuthProfileAddress[];
}

interface AuthProfileAddress {
  id: string;
  erp_address_id: string;
  label?: string;
  pricelist_code?: string;
  street?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
}
```

### B2BCustomer

```typescript
interface B2BCustomer {
  id: string;
  erp_customer_id: string;
  name?: string;
  business_name?: string;
  vat_number?: string;
  fiscal_code?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### B2BAddress

```typescript
interface B2BAddress {
  id: string;
  erp_address_id: string;
  customer_id: string;
  label?: string;
  street?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  phone?: string;
  email?: string;
  pricelist_code?: string;
  payment_terms_code?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

---

## Related Documentation

- [SSO Authentication API](./sso-api.md) - OAuth and session management
- [Notification Templates](./notifications-api.md) - Email notifications
