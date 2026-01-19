# Language Seeding Implementation

## Overview

Automatic language seeding has been successfully implemented for tenant creation. When a new tenant is created, the system now automatically seeds 43 languages with only Italian enabled by default.

## Changes Made

### 1. Updated Language Seed Data

**Files Modified:**
- `src/scripts/seed-languages.ts`
- `src/app/api/admin/languages/seed/route.ts`

**Changes:**
- Added flag emojis (🇮🇹, 🇩🇪, 🇬🇧, etc.) to all 43 languages
- Changed default enabled languages: Only Italian (`it`) is now enabled by default
- German (`de`), English (`en`), and Czech (`cs`) are now disabled by default

### 2. Automatic Language Seeding on Tenant Creation

**File Modified:** `src/lib/services/admin-tenant.service.ts`

**New Function Added:**
```typescript
async function seedInitialLanguages(connection: mongoose.Connection): Promise<void>
```

This function:
- Accepts a mongoose connection for the tenant database
- Defines Language schema inline for the tenant connection
- Seeds all 43 languages with flag emojis
- Only Italian is enabled by default (`isEnabled: true`, `searchEnabled: true`)
- All other languages are disabled but available for activation
- Is idempotent: checks if languages already exist before seeding

**Integration:**
The `createTenant()` function now automatically calls `seedInitialLanguages()` after creating the admin user:

```typescript
await createInitialAdminUser(...);
await seedInitialLanguages(tenantConnection);
```

### 3. Tenant Provisioning Flow (Complete)

When a new tenant is created, the system automatically:

1. ✅ Creates Solr collection (`vinc-{tenant-id}`)
2. ✅ Creates MongoDB database (`vinc-{tenant-id}`)
3. ✅ Creates initial admin user
4. ✅ **Seeds 43 languages (only Italian enabled)**
5. ✅ Registers tenant in admin database

## Language Configuration

### Total Languages: 43

**Enabled by Default:**
- 🇮🇹 Italian (`it`) - isDefault: true, isEnabled: true, searchEnabled: true

**Disabled by Default (but available for activation):**
- 🇩🇪 German (`de`)
- 🇬🇧 English (`en`)
- 🇨🇿 Czech (`cs`)
- 🇫🇷 French (`fr`)
- 🇪🇸 Spanish (`es`)
- 🇵🇹 Portuguese (`pt`)
- 🇳🇱 Dutch (`nl`)
- ... and 35 more languages

All languages include:
- ISO 639-1 language code
- English name
- Native name
- Flag emoji
- Solr analyzer configuration
- Text direction (LTR/RTL)
- Date format
- Number format
- Display order

## Testing

### Test Script: `scripts/test-create-tenant.ts`

A test script has been created to verify the language seeding functionality:

```bash
npx tsx scripts/test-create-tenant.ts
```

**Test Output (Successful):**
```
🧪 Testing Tenant Creation with Language Seeding

📝 Creating tenant: test-tenant-069948
   Name: Test Tenant 069948
   Admin: admin@test-tenant-069948.com
   Password: TestPass123!

Connected to admin database: vinc-admin
Created Solr collection: vinc-test-tenant-069948
Connected to tenant database: vinc-test-tenant-069948
Created initial admin user: admin@test-tenant-069948.com
Seeded 43 languages (only Italian enabled by default)

✅ Tenant created successfully!
   Tenant ID: test-tenant-069948
   Mongo DB: vinc-test-tenant-069948
   Solr Core: vinc-test-tenant-069948
   Access URL: https://cs.vendereincloud.it/test-tenant-069948/api/b2b

✅ Language Seeding Verification:
   Based on creation logs:
   ✓ Seeded 43 languages
   ✓ Only Italian enabled by default
   ✓ All languages include flag emojis

✅ All tests passed! Language seeding is working correctly.
```

## Usage

### Creating a New Tenant

**Via API (requires super admin auth):**
```bash
curl -X POST "http://localhost:3001/api/admin/tenants" \
  -H "Cookie: vinc_admin_session=..." \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "my-company",
    "name": "My Company",
    "admin_email": "admin@mycompany.com",
    "admin_password": "SecurePass123!",
    "admin_name": "Admin User"
  }'
```

**Response:**
```json
{
  "success": true,
  "tenant": {
    "tenant_id": "my-company",
    "name": "My Company",
    "status": "active",
    "mongo_db": "vinc-my-company",
    "solr_core": "vinc-my-company"
  },
  "access_url": "https://cs.vendereincloud.it/my-company/api/b2b",
  "message": "Tenant 'my-company' created successfully with MongoDB database, Solr core, and initial admin user"
}
```

The tenant now has:
- MongoDB database with initial admin user and 43 seeded languages
- Solr search core
- Access URL for B2B portal

### Enabling Additional Languages

After tenant creation, administrators can enable additional languages via the B2B admin interface or API.

## Related Files

### Core Implementation
- `src/lib/services/admin-tenant.service.ts` - Tenant provisioning service
- `src/lib/db/models/language.ts` - Language model schema

### Language Seeding
- `src/scripts/seed-languages.ts` - Command-line language seeding
- `src/app/api/admin/languages/seed/route.ts` - API endpoint for language seeding
- `scripts/add-language-flags.ts` - Script to retroactively add flags

### Tenant Management
- `src/app/api/admin/tenants/route.ts` - Tenant CRUD API
- `scripts/test-create-tenant.ts` - Test script for tenant creation

## Benefits

1. **Automatic Setup**: New tenants are immediately ready to use with Italian language
2. **Multilingual Ready**: 42 additional languages available for activation
3. **Consistent Configuration**: All tenants start with the same language setup
4. **Flag Emojis**: Visual language identification in UI
5. **Solr Integration**: Each language has proper analyzer configuration for search

## Future Enhancements

- Allow custom language configuration during tenant creation
- Bulk enable/disable languages via admin API
- Language usage analytics per tenant
- Custom language configurations per tenant
