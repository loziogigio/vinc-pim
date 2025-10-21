# B2B Module - Quick Start Guide

## Installation (2 minutes)

```bash
# Run the automated setup
./scripts/setup-b2b.sh
```

That's it! The script will:
- Install required dependencies (bcryptjs, @radix-ui/react-label)
- Create .env.local with secure session secret
- Seed the database with test data

## Access the Portal

```bash
# Start the dev server
pnpm dev
```

Then navigate to: **http://localhost:3000/b2b/login**

### Login Credentials
- **Username**: `b2b_admin`
- **Password**: `admin123`

## What You'll See

### 1. Dashboard (`/b2b/dashboard`)
The main landing page with:
- **Catalog Overview**: Total products, enhanced count, items needing attention
- **Needs Attention**: Action items (synced products, missing content, missing images)
- **Recent Activity**: Timeline of recent actions
- **Quick Search**: Search products with status filters
- **Quick Actions**: Shortcuts to common tasks

### 2. Catalog (`/b2b/catalog`)
Product management interface with:
- Full product listing with pagination
- Search by SKU, title, or category
- Filter by status
- Bulk selection
- Status indicators

## Key Files

### Pages
- `/b2b/login` → [src/app/b2b/login/page.tsx](../src/app/b2b/login/page.tsx)
- `/b2b/dashboard` → [src/app/b2b/(protected)/dashboard/page.tsx](../src/app/b2b/(protected)/dashboard/page.tsx)
- `/b2b/catalog` → [src/app/b2b/(protected)/catalog/page.tsx](../src/app/b2b/(protected)/catalog/page.tsx)

### API Endpoints
- `POST /api/b2b/login` → [src/app/api/b2b/login/route.ts](../src/app/api/b2b/login/route.ts)
- `POST /api/b2b/logout` → [src/app/api/b2b/logout/route.ts](../src/app/api/b2b/logout/route.ts)
- `GET /api/b2b/dashboard` → [src/app/api/b2b/dashboard/route.ts](../src/app/api/b2b/dashboard/route.ts)
- `GET /api/b2b/catalog` → [src/app/api/b2b/catalog/route.ts](../src/app/api/b2b/catalog/route.ts)

### Database Models
- B2B User → [src/lib/db/models/b2b-user.ts](../src/lib/db/models/b2b-user.ts)
- B2B Product → [src/lib/db/models/b2b-product.ts](../src/lib/db/models/b2b-product.ts)
- Activity Log → [src/lib/db/models/activity-log.ts](../src/lib/db/models/activity-log.ts)

## Sample Data

The seed script creates:
- 1 admin user (`b2b_admin`)
- 5 sample products with different statuses:
  - Enhanced (with marketing content)
  - Not Enhanced
  - Needs Attention
  - Missing Data
  - Various categories (Pumps, Valves, Tanks, Controls, Piping)
- 3 sample activity logs

## Manual Setup (if needed)

If the automated script doesn't work:

```bash
# 1. Install dependencies
pnpm add bcryptjs @radix-ui/react-label
pnpm add -D @types/bcryptjs

# 2. Create .env.local
cat > .env.local <<EOF
VINC_MONGO_URI=mongodb://localhost:27017/vinc-storefront
SESSION_SECRET=$(openssl rand -base64 32)
NODE_ENV=development
EOF

# 3. Seed database
npx tsx scripts/seed-b2b-user.ts

# 4. Start dev server
pnpm dev
```

## Common Issues

### "Cannot connect to MongoDB"
- Make sure MongoDB is running: `mongod` or check your MongoDB service
- Verify connection string in `.env.local`

### "Unauthorized" error
- Clear browser cookies
- Re-login with correct credentials
- Check session secret is set in `.env.local`

### Missing dependencies error
- Run: `pnpm add bcryptjs @radix-ui/react-label`
- Run: `pnpm add -D @types/bcryptjs`

### No products showing
- Run the seed script: `npx tsx scripts/seed-b2b-user.ts`
- Check MongoDB database has products

## Next Steps

1. ✅ Login and explore the dashboard
2. ✅ Browse the product catalog
3. ✅ Try searching and filtering
4. ✅ Test bulk selection
5. 📖 Read [B2B_MODULE_SETUP.md](B2B_MODULE_SETUP.md) for detailed info
6. 📖 Review [B2B_MODULE_SUMMARY.md](B2B_MODULE_SUMMARY.md) for architecture

## Features Checklist

- ✅ User authentication
- ✅ Session management
- ✅ Dashboard with metrics
- ✅ Product catalog listing
- ✅ Search & filtering
- ✅ Pagination
- ✅ Bulk selection
- ✅ Activity logging
- ✅ Responsive design
- ✅ Dark mode support

## Development

To modify or extend:
1. Components are in `src/components/b2b/`
2. Pages are in `src/app/b2b/`
3. API routes are in `src/app/api/b2b/`
4. Models are in `src/lib/db/models/`
5. Types are in `src/lib/types/b2b.ts`

## Support

- 📖 [Full Setup Guide](B2B_MODULE_SETUP.md)
- 📖 [Implementation Summary](B2B_MODULE_SUMMARY.md)
- 📖 [Original Design](B2B_BUILDER.MD)

---

**Ready to go!** 🚀
