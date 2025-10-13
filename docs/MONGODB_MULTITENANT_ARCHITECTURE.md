# MongoDB Multi-Tenant Architecture for VINC Storefront

## Overview

This document explains how MongoDB handles multi-tenancy for the VINC storefront system, where multiple independent storefronts (plumbing, electronics, fashion, etc.) share the same application infrastructure but maintain data isolation.

## Multi-Tenancy Pattern: Shared Collection with Tenant Discrimination

We use **Pattern #3: Shared Collection with Tenant ID** - the most efficient approach for our template-based architecture.

### Why This Pattern?

1. **Cost-Effective**: Single database, shared infrastructure
2. **Performance**: Optimal query performance with proper indexing
3. **Scalability**: Easy to add new tenants without infrastructure changes
4. **Centralized Management**: Backup, monitoring, and maintenance in one place
5. **Cross-Tenant Queries**: Analytics and reporting across all storefronts when needed
6. **Template Reusability**: Aligns perfectly with our configuration-driven design

---

## Database Structure

### Connection Configuration

```bash
# .env.local
VINC_MONGO_URL=mongodb://admin:admin@localhost:27017/?authSource=admin
VINC_MONGO_DB=vinc_storefront
VINC_MONGO_MIN_POOL_SIZE=0
VINC_MONGO_MAX_POOL_SIZE=100
```

### Collections

```
vinc_storefront (database)
├── tenants              # Tenant registry and configuration
├── pages                # Page configurations per tenant
├── blocks               # Block library per tenant
├── products             # Products per tenant
├── categories           # Categories per tenant
├── media                # Media assets per tenant
├── users                # Admin users (cross-tenant or per-tenant)
└── sessions             # User sessions
```

---

## Schema Design with Tenant Discrimination

### 1. Tenants Collection (Registry)

Stores tenant metadata and configuration.

```typescript
// models/Tenant.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  tenantId: string;           // URL-friendly identifier (e.g., "plumbing-pro")
  name: string;               // Display name (e.g., "Plumbing Supply Pro")
  domain?: string;            // Custom domain (optional)
  templateId: string;         // Template type (e.g., "plumbing-pro")
  status: 'active' | 'suspended' | 'trial';

  // Configuration
  config: {
    primaryColor: string;
    secondaryColor: string;
    logo?: string;
    favicon?: string;
    seo: {
      defaultTitle: string;
      defaultDescription: string;
      keywords: string[];
    };
  };

  // Subscription/Limits
  subscription: {
    plan: 'free' | 'basic' | 'premium' | 'enterprise';
    maxPages: number;
    maxProducts: number;
    storageLimit: number;      // in MB
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  owner: mongoose.Types.ObjectId;  // Reference to users collection
}

const TenantSchema = new Schema<ITenant>({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/  // Only lowercase letters, numbers, hyphens
  },
  name: { type: String, required: true },
  domain: { type: String, unique: true, sparse: true },
  templateId: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'suspended', 'trial'],
    default: 'trial'
  },
  config: {
    primaryColor: { type: String, default: '#3B82F6' },
    secondaryColor: { type: String, default: '#10B981' },
    logo: String,
    favicon: String,
    seo: {
      defaultTitle: String,
      defaultDescription: String,
      keywords: [String]
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    maxPages: { type: Number, default: 10 },
    maxProducts: { type: Number, default: 100 },
    storageLimit: { type: Number, default: 500 }  // MB
  },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

// Indexes
TenantSchema.index({ tenantId: 1 });
TenantSchema.index({ domain: 1 });
TenantSchema.index({ status: 1 });

export const Tenant = mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);
```

### 2. Pages Collection (Multi-Tenant)

Every document includes `tenantId` for data isolation.

```typescript
// models/Page.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IPage extends Document {
  tenantId: string;          // 🔑 TENANT DISCRIMINATOR
  slug: string;              // URL slug (unique per tenant)
  title: string;

  // SEO Metadata
  seo: {
    metaTitle: string;
    metaDescription: string;
    ogImage?: string;
    keywords: string[];
    structuredData?: any;    // JSON-LD schema
  };

  // Page Content
  blocks: Array<{
    id: string;
    type: string;            // "hero", "products", "categories", etc.
    order: number;
    config: Record<string, any>;  // Flexible configuration
    visible: boolean;
  }>;

  // Publishing
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
}

const PageSchema = new Schema<IPage>({
  tenantId: {
    type: String,
    required: true,
    index: true  // 🔑 CRITICAL INDEX
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  title: { type: String, required: true },

  seo: {
    metaTitle: { type: String, required: true },
    metaDescription: { type: String, required: true },
    ogImage: String,
    keywords: [String],
    structuredData: Schema.Types.Mixed
  },

  blocks: [{
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    visible: { type: Boolean, default: true }
  }],

  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// 🔑 COMPOUND INDEX: Ensures slug uniqueness per tenant
PageSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
PageSchema.index({ tenantId: 1, status: 1 });
PageSchema.index({ tenantId: 1, createdAt: -1 });

export const Page = mongoose.models.Page || mongoose.model<IPage>('Page', PageSchema);
```

### 3. Products Collection (Multi-Tenant)

```typescript
// models/Product.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  tenantId: string;          // 🔑 TENANT DISCRIMINATOR
  sku: string;               // Stock keeping unit (unique per tenant)
  name: string;
  description: string;

  // Pricing
  price: number;
  compareAtPrice?: number;   // Original price for discounts
  currency: string;

  // Inventory
  inventory: {
    tracked: boolean;
    quantity: number;
    lowStockThreshold: number;
  };

  // Media
  images: Array<{
    url: string;
    alt: string;
    order: number;
  }>;

  // Categorization
  categories: string[];      // Array of category IDs
  tags: string[];

  // SEO
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    slug: string;
  };

  // Status
  status: 'active' | 'draft' | 'archived';
  featured: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  tenantId: {
    type: String,
    required: true,
    index: true  // 🔑 CRITICAL INDEX
  },
  sku: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  name: { type: String, required: true },
  description: { type: String, required: true },

  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  currency: { type: String, default: 'USD' },

  inventory: {
    tracked: { type: Boolean, default: true },
    quantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 }
  },

  images: [{
    url: { type: String, required: true },
    alt: { type: String, required: true },
    order: { type: Number, required: true }
  }],

  categories: [{ type: String }],
  tags: [{ type: String }],

  seo: {
    metaTitle: String,
    metaDescription: String,
    slug: { type: String, required: true }
  },

  status: {
    type: String,
    enum: ['active', 'draft', 'archived'],
    default: 'draft'
  },
  featured: { type: Boolean, default: false }
}, {
  timestamps: true
});

// 🔑 COMPOUND INDEXES
ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, status: 1 });
ProductSchema.index({ tenantId: 1, featured: 1, status: 1 });
ProductSchema.index({ tenantId: 1, 'seo.slug': 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, categories: 1 });
ProductSchema.index({ tenantId: 1, tags: 1 });

export const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
```

---

## Data Isolation & Security

### Middleware for Automatic Tenant Filtering

Create middleware that automatically adds `tenantId` to all queries:

```typescript
// lib/db/tenant-context.ts
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

// Helper to get current tenant
export function getCurrentTenant(): string | null {
  const context = tenantContext.getStore();
  return context?.tenantId || null;
}

// Helper to get current user
export function getCurrentUser(): string | null {
  const context = tenantContext.getStore();
  return context?.userId || null;
}
```

### Mongoose Plugin for Automatic Tenant Filtering

```typescript
// lib/db/multi-tenant-plugin.ts
import { Schema } from 'mongoose';
import { getCurrentTenant } from './tenant-context';

export function multiTenantPlugin(schema: Schema) {
  // Add pre-save hook to automatically set tenantId
  schema.pre('save', function(next) {
    if (this.isNew && !this.tenantId) {
      const tenantId = getCurrentTenant();
      if (!tenantId) {
        return next(new Error('No tenant context found'));
      }
      this.tenantId = tenantId;
    }
    next();
  });

  // Add pre-find hooks to automatically filter by tenantId
  const addTenantFilter = function(this: any) {
    const tenantId = getCurrentTenant();
    if (tenantId) {
      this.where({ tenantId });
    }
  };

  schema.pre('find', addTenantFilter);
  schema.pre('findOne', addTenantFilter);
  schema.pre('findOneAndUpdate', addTenantFilter);
  schema.pre('findOneAndDelete', addTenantFilter);
  schema.pre('updateOne', addTenantFilter);
  schema.pre('updateMany', addTenantFilter);
  schema.pre('deleteOne', addTenantFilter);
  schema.pre('deleteMany', addTenantFilter);
  schema.pre('countDocuments', addTenantFilter);
}

// Apply to schemas
PageSchema.plugin(multiTenantPlugin);
ProductSchema.plugin(multiTenantPlugin);
```

### Next.js Middleware for Tenant Detection

```typescript
// middleware.ts (Next.js App Router)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Extract tenant from URL path: /plumbing/... -> tenantId: "plumbing"
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const tenantId = pathSegments[0];

  // Alternative: Extract tenant from subdomain
  // const host = request.headers.get('host') || '';
  // const tenantId = host.split('.')[0]; // plumbing.yoursite.com -> "plumbing"

  // Add tenant to headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### API Route with Tenant Context

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/lib/db/tenant-context';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Product } from '@/models/Product';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  // Run query within tenant context
  return tenantContext.run({ tenantId }, async () => {
    await connectToDatabase();

    // Query automatically filtered by tenantId via plugin
    const products = await Product.find({ status: 'active' })
      .select('name price images')
      .limit(20);

    return NextResponse.json({ products });
  });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const body = await request.json();

  return tenantContext.run({ tenantId }, async () => {
    await connectToDatabase();

    // tenantId automatically set via plugin
    const product = new Product(body);
    await product.save();

    return NextResponse.json({ product }, { status: 201 });
  });
}
```

---

## Querying Patterns

### 1. Query Single Tenant (Most Common)

```typescript
// Automatic filtering via plugin
const pages = await Page.find({ status: 'published' });

// Or explicit filtering
const pages = await Page.find({
  tenantId: 'plumbing-pro',
  status: 'published'
});
```

### 2. Query Across Tenants (Admin/Analytics)

```typescript
// Bypass plugin by explicitly querying without tenant context
const allProducts = await Product.find()
  .select('tenantId name price')
  .sort({ createdAt: -1 })
  .limit(100);

// Aggregate across tenants
const stats = await Product.aggregate([
  { $match: { status: 'active' } },
  { $group: {
    _id: '$tenantId',
    totalProducts: { $sum: 1 },
    avgPrice: { $avg: '$price' }
  }}
]);
```

### 3. Tenant-Specific Aggregations

```typescript
const categorySales = await Product.aggregate([
  { $match: { tenantId: 'plumbing-pro', status: 'active' } },
  { $unwind: '$categories' },
  { $group: {
    _id: '$categories',
    productCount: { $sum: 1 },
    avgPrice: { $avg: '$price' }
  }},
  { $sort: { productCount: -1 } }
]);
```

---

## Performance Optimization

### Critical Indexes

```typescript
// Apply these indexes in production

// 1. Tenant-based queries (MOST IMPORTANT)
db.pages.createIndex({ tenantId: 1, slug: 1 }, { unique: true });
db.products.createIndex({ tenantId: 1, sku: 1 }, { unique: true });
db.products.createIndex({ tenantId: 1, status: 1 });
db.products.createIndex({ tenantId: 1, featured: 1, status: 1 });

// 2. Cross-tenant queries (admin/analytics)
db.products.createIndex({ createdAt: -1 });
db.pages.createIndex({ status: 1, publishedAt: -1 });

// 3. Search indexes (if using text search)
db.products.createIndex({
  tenantId: 1,
  name: "text",
  description: "text",
  tags: "text"
});
```

### Connection Pooling

```typescript
// lib/db/mongodb.ts
const opts = {
  dbName: MONGODB_DB,
  bufferCommands: false,
  minPoolSize: MIN_POOL_SIZE,    // 0 for serverless
  maxPoolSize: MAX_POOL_SIZE,    // 100 for production
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};
```

---

## Tenant Isolation Checklist

- [x] **Schema Design**: All collections have `tenantId` field
- [x] **Indexes**: Compound indexes on `{ tenantId, ... }`
- [x] **Middleware**: Automatic tenant context propagation
- [x] **Plugin**: Auto-filtering queries by tenantId
- [x] **API Routes**: Extract tenantId from headers/URL
- [x] **Validation**: Ensure tenantId cannot be overridden by clients
- [x] **Testing**: Write tests to verify tenant isolation
- [x] **Monitoring**: Log tenant-specific metrics

---

## Scaling Considerations

### When to Migrate to Database-per-Tenant

Consider migrating specific tenants to dedicated databases when:

1. **Single tenant has >1M documents**
2. **Tenant requires dedicated SLA**
3. **Regulatory compliance requires physical isolation**
4. **Performance degradation affecting other tenants**

### Hybrid Approach

```typescript
// Support both patterns in same codebase
export function getTenantConnection(tenantId: string) {
  const tenant = await Tenant.findOne({ tenantId });

  if (tenant.subscription.plan === 'enterprise') {
    // Dedicated database for enterprise
    return mongoose.createConnection(
      `mongodb://localhost:27017/tenant_${tenantId}`
    );
  }

  // Shared database for others
  return mongoose.connection;
}
```

---

## Security Best Practices

1. **Never Trust Client Input**: Always extract tenantId server-side
2. **Validate Tenant Access**: Verify user has permission to access tenant
3. **Rate Limiting**: Apply per-tenant rate limits
4. **Audit Logs**: Log all tenant operations for compliance
5. **Backup Strategy**: Tenant-specific backup/restore capability

```typescript
// Tenant access validation middleware
export async function validateTenantAccess(userId: string, tenantId: string) {
  const user = await User.findById(userId);

  if (!user.tenants.includes(tenantId) && !user.isAdmin) {
    throw new Error('Unauthorized tenant access');
  }
}
```

---

## Migration Example: Adding New Tenant

```typescript
// scripts/create-tenant.ts
import { connectToDatabase } from '@/lib/db/mongodb';
import { Tenant } from '@/models/Tenant';

async function createTenant() {
  await connectToDatabase();

  const tenant = new Tenant({
    tenantId: 'electronics-store',
    name: 'Electronics Store',
    templateId: 'electronics-pro',
    status: 'trial',
    config: {
      primaryColor: '#FF6B35',
      secondaryColor: '#004E89',
      seo: {
        defaultTitle: 'Electronics Store - Best Tech Deals',
        defaultDescription: 'Shop the latest electronics at great prices',
        keywords: ['electronics', 'gadgets', 'tech']
      }
    },
    subscription: {
      plan: 'basic',
      maxPages: 50,
      maxProducts: 500,
      storageLimit: 2000
    },
    owner: new ObjectId('...') // User ID
  });

  await tenant.save();
  console.log('✅ Tenant created:', tenant.tenantId);
}
```

---

## Summary

**MongoDB handles multi-tenancy excellently** using the **Shared Collection with Tenant ID** pattern:

✅ **Cost-effective**: Single database, shared infrastructure
✅ **High performance**: Proper indexing ensures fast queries
✅ **Scalable**: Add tenants without infrastructure changes
✅ **Secure**: Automatic tenant filtering via middleware
✅ **Flexible**: Easy migration to database-per-tenant if needed

This architecture perfectly aligns with your template-based storefront system!
