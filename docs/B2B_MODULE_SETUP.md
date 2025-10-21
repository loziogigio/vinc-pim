# B2B Module Setup Guide

This guide will help you set up and run the B2B Product Catalog Manager module.

## Overview

The B2B module provides a dedicated portal for managing product catalogs with features like:
- Activity Dashboard with catalog overview
- Product catalog management with search and filters
- User authentication and session management
- Activity logging and audit trail
- Bulk operations for product enhancement

## Installation

### 1. Install Required Dependencies

```bash
pnpm add bcryptjs @radix-ui/react-label
pnpm add -D @types/bcryptjs
```

### 2. Environment Variables

Ensure you have the following environment variables set in your `.env.local`:

```env
# MongoDB Connection
VINC_MONGO_URI=mongodb://localhost:27017/vinc-storefront

# Session Secret (generate a secure random string)
SESSION_SECRET=your-secure-session-secret-at-least-32-characters-long

# Node Environment
NODE_ENV=development
```

### 3. Database Setup

Run the seed script to create a test B2B user and sample data:

```bash
npx tsx scripts/seed-b2b-user.ts
```

This will create:
- B2B admin user (username: `b2b_admin`, password: `admin123`)
- Sample products with various statuses
- Sample activity logs

## File Structure

```
src/
├── app/
│   ├── b2b/
│   │   ├── (protected)/
│   │   │   ├── layout.tsx              # Protected route wrapper
│   │   │   ├── dashboard/page.tsx      # Main dashboard
│   │   │   └── catalog/page.tsx        # Product catalog
│   │   └── login/page.tsx              # B2B login page
│   └── api/
│       └── b2b/
│           ├── login/route.ts          # Login API
│           ├── logout/route.ts         # Logout API
│           ├── dashboard/route.ts      # Dashboard data API
│           └── catalog/route.ts        # Catalog API
│
├── components/
│   └── b2b/
│       ├── DashboardHeader.tsx         # Header with user info
│       ├── LoginForm.tsx               # Login form component
│       ├── CatalogOverviewCards.tsx    # Dashboard overview cards
│       ├── NeedsAttentionPanel.tsx     # Attention items panel
│       ├── RecentActivityPanel.tsx     # Activity feed
│       ├── QuickSearchSection.tsx      # Search component
│       ├── QuickActionsSection.tsx     # Quick actions
│       └── ProductsTable.tsx           # Product listing table
│
├── lib/
│   ├── auth/
│   │   └── b2b-session.ts              # B2B session management
│   ├── types/
│   │   └── b2b.ts                      # B2B TypeScript types
│   └── db/
│       └── models/
│           ├── b2b-user.ts             # B2B user model
│           ├── b2b-product.ts          # B2B product model
│           └── activity-log.ts         # Activity log model
```

## Usage

### 1. Start the Development Server

```bash
pnpm dev
```

### 2. Access the B2B Portal

Navigate to: [http://localhost:3000/b2b/login](http://localhost:3000/b2b/login)

Login with:
- **Username**: `b2b_admin`
- **Password**: `admin123`

### 3. Main Features

#### Dashboard (`/b2b/dashboard`)
- Catalog overview with key metrics
- Needs attention panel showing items requiring action
- Recent activity feed
- Quick search with filters
- Quick action buttons

#### Catalog Management (`/b2b/catalog`)
- Full product listing with pagination
- Search by SKU, title, or category
- Filter by product status
- Bulk selection and operations
- Product status indicators

## Architecture

### Authentication Flow

1. User submits login form at `/b2b/login`
2. API validates credentials against MongoDB
3. Session created using `iron-session`
4. User redirected to `/b2b/dashboard`
5. Protected routes check session via layout wrapper

### Session Management

Sessions are managed using `iron-session` with:
- Secure cookie-based sessions
- 7-day expiration
- Automatic redirect for unauthenticated users

### Database Models

#### B2B User
```typescript
{
  username: string;
  email: string;
  passwordHash: string;
  role: "admin" | "manager" | "viewer";
  companyName: string;
  isActive: boolean;
  lastLoginAt?: Date;
}
```

#### B2B Product
```typescript
{
  sku: string;
  title: string;
  category: string;
  status: "enhanced" | "not_enhanced" | "needs_attention" | "missing_data";
  description?: string;
  marketingContent?: string;
  images: string[];
  price?: number;
  stock?: number;
  erpData?: any;
  lastSyncedAt?: Date;
  enhancedAt?: Date;
}
```

#### Activity Log
```typescript
{
  type: "erp_sync" | "bulk_enhancement" | "product_update" | "image_upload" | "user_login" | "catalog_export";
  description: string;
  details?: any;
  performedBy: string;
  createdAt: Date;
}
```

## API Endpoints

### Authentication
- `POST /api/b2b/login` - User login
- `POST /api/b2b/logout` - User logout

### Data
- `GET /api/b2b/dashboard` - Dashboard overview data
- `GET /api/b2b/catalog` - Product catalog with search/filter/pagination

### Query Parameters for Catalog API
- `q` - Search query (SKU, title, category)
- `filter` - Filter type (enhanced, not_enhanced, needs_attention, missing_data, missing_images, recent_sync)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

## Development

### Creating New B2B Users

Use the MongoDB shell or a script to create new users:

```javascript
const bcrypt = require('bcryptjs');
const passwordHash = await bcrypt.hash('password', 10);

await B2BUserModel.create({
  username: 'newuser',
  email: 'user@example.com',
  passwordHash,
  role: 'manager',
  companyName: 'Company Name',
  isActive: true,
});
```

### Adding New Products

Products can be added via:
1. Direct database insertion
2. ERP sync API (to be implemented)
3. Manual import (to be implemented)

## Security Considerations

1. **Password Hashing**: All passwords are hashed using bcrypt with 10 rounds
2. **Session Security**: Sessions use secure cookies in production
3. **Authentication**: All protected routes require valid session
4. **Role-Based Access**: User roles control access levels (future feature)

## Next Steps

Future enhancements could include:
- Bulk AI enhancement functionality
- ERP integration for product sync
- Image upload and management
- Advanced filtering and export
- Role-based permissions
- Multi-company support
- Email notifications
- API webhooks

## Troubleshooting

### Login Issues
- Check MongoDB connection
- Verify user exists in database
- Check session secret is configured
- Clear browser cookies

### Data Not Loading
- Verify API endpoints are accessible
- Check MongoDB connection
- Review browser console for errors
- Check server logs

### Permission Errors
- Ensure user has correct role
- Check session is valid
- Verify protected route wrapper is in place

## Support

For issues or questions:
1. Check the main documentation in `/docs/B2B_BUILDER.MD`
2. Review the code comments in source files
3. Contact your development team
