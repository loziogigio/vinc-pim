# Template System Implementation Guide

## 🎯 Overview

Transform the existing `vinc-storefront` design into a **centralized, template-based CMS** that makes it easy to create new storefronts by simply changing configuration - keeping the same components but with different content and styling.

### Current State Analysis

**Existing Components in vinc-storefront:**
- ✅ Header with category scroller
- ✅ 4 Hero variants (Banner, Split, Grid, Carousel)
- ✅ Product slider/carousel
- ✅ Category grid preview
- ✅ Blog/content slider
- ✅ Brand logos row
- ✅ Footer with newsletter
- ✅ Dark mode toggle
- ✅ Control panel for live preview

### Target Architecture

```
vinc-apps/
├── vinc-storefront/               # Existing React app (keep as is for now)
├── vinc-cms/                      # NEW: Next.js CMS (production)
│   ├── config/
│   │   ├── templates/             # CENTRALIZED: All template configs
│   │   │   ├── index.ts          # Template registry
│   │   │   ├── plumbing/         # Template 1 (from vinc-storefront)
│   │   │   │   ├── template.config.ts
│   │   │   │   ├── blocks.config.ts
│   │   │   │   └── theme.config.ts
│   │   │   ├── electronics/      # Template 2 (future)
│   │   │   └── fashion/          # Template 3 (future)
│   │   ├── blocks.config.ts      # Global block definitions
│   │   └── seo.config.ts         # Global SEO defaults
│   ├── components/
│   │   ├── blocks/               # Reusable block components
│   │   │   ├── HeroSection/
│   │   │   ├── ProductSection/
│   │   │   ├── CategorySection/
│   │   │   ├── ContentSection/
│   │   │   ├── BrandSection/
│   │   │   └── FooterSection/
│   │   ├── builder/              # Admin builder UI
│   │   └── renderer/             # SSR renderer
│   ├── app/
│   │   ├── (public)/             # Public SSR pages
│   │   │   └── [template]/       # Dynamic template routes
│   │   └── admin/                # Admin CMS
│   ├── models/                   # MongoDB schemas
│   └── lib/
│       ├── db/                   # MongoDB operations
│       └── templates/            # Template utilities
└── doc/
    └── TEMPLATE_SYSTEM_IMPLEMENTATION.md  # This file
```

---

## 📋 Phase 1: Extract & Analyze Current Design

### Components to Extract from App.tsx

1. **Header Component**
   - Sticky navigation
   - Category horizontal scroller
   - Search bar
   - Dark mode toggle
   - Shopping cart button

2. **Hero Components** (4 variants)
   - HeroBanner (full-width with overlay)
   - HeroSplit (text left, image right)
   - HeroGrid (masonry grid of categories)
   - HeroCarousel (auto-rotating slides)

3. **Product Section**
   - HorizontalSlider (reusable)
   - ProductCard (product display)

4. **Category Section**
   - Grid layout
   - Category cards with images

5. **Content/Blog Section**
   - BlogCard (article preview)
   - HorizontalSlider (reused)

6. **Brand Section**
   - Simple logo grid

7. **Footer Component**
   - Multi-column links
   - Newsletter signup

### Current Data Structure (to be moved to config)

```typescript
// Currently hardcoded in App.tsx
const categories = [...];  // 10 plumbing categories
const products = [...];    // 8 plumbing products
const posts = [...];       // 4 blog posts
```

---

## 🗂️ Phase 2: Create Centralized Template Configuration

### File: `config/templates/plumbing/template.config.ts`

```typescript
import { TemplateConfig } from '@/lib/types/template';

export const plumbingTemplate: TemplateConfig = {
  id: 'plumbing-pro',
  name: 'Plumbing Professional',
  description: 'B2B storefront for plumbing supply and trade professionals',
  version: '1.0.0',
  industry: 'plumbing',

  // Brand identity
  branding: {
    storeName: 'VINC Plumbing Supply',
    logo: '/templates/plumbing/logo.svg',
    tagline: 'Professional Tools & Materials',
    colors: {
      primary: '#2563eb',      // Blue
      secondary: '#7c3aed',    // Purple
      accent: '#f59e0b',       // Amber
      background: '#ffffff',
      foreground: '#0a0a0a'
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter'
    }
  },

  // Page layout configuration
  layout: {
    header: {
      sticky: true,
      showSearch: true,
      showCart: true,
      showDarkMode: true,
      categoryScroller: {
        enabled: true,
        scrollBehavior: 'smooth'
      }
    },
    footer: {
      columns: 4,
      showNewsletter: true,
      showSocial: true
    }
  },

  // Default page blocks (what appears on homepage)
  defaultBlocks: [
    {
      id: 'hero-1',
      type: 'hero-banner',
      order: 0,
      config: {
        variant: 'banner',
        title: 'Professional Plumbing Supply',
        subtitle: 'Quality tools and materials delivered fast',
        cta: {
          primary: {
            text: 'Shop Now',
            link: '/shop'
          },
          secondary: {
            text: 'View Catalog',
            link: '/catalog'
          }
        },
        background: {
          type: 'image',
          src: 'https://images.unsplash.com/photo-1581166418878-11f0dde922c2',
          alt: 'Professional plumbing tools',
          overlay: 0.4
        },
        height: 'large',
        textAlign: 'left'
      }
    },
    {
      id: 'products-1',
      type: 'product-slider',
      order: 1,
      config: {
        variant: 'slider',
        title: 'Best Sellers',
        subtitle: 'Top-rated by professionals',
        collection: 'best-sellers',
        limit: 8,
        showBadges: true,
        showQuickAdd: true
      }
    },
    {
      id: 'categories-1',
      type: 'category-grid',
      order: 2,
      config: {
        variant: 'grid',
        title: 'Shop by Category',
        layout: 'grid',
        columns: { mobile: 2, tablet: 3, desktop: 5 },
        showImage: true,
        categories: [] // Populated from categories config
      }
    },
    {
      id: 'content-1',
      type: 'blog-slider',
      order: 3,
      config: {
        variant: 'slider',
        title: 'Stories & Guides',
        limit: 6,
        showExcerpt: true
      }
    },
    {
      id: 'brands-1',
      type: 'brand-grid',
      order: 4,
      config: {
        variant: 'grid',
        columns: { mobile: 2, tablet: 4, desktop: 6 },
        brands: [] // Populated from brands config
      }
    }
  ],

  // SEO settings
  seo: {
    title: 'Professional Plumbing Supply | VINC',
    description: 'Quality plumbing supplies, tools, and equipment for trade professionals. Fast delivery, competitive pricing, expert support.',
    keywords: ['plumbing supply', 'trade plumbing', 'professional tools', 'plumbing equipment'],
    ogImage: '/templates/plumbing/og-image.jpg'
  }
};
```

### File: `config/templates/plumbing/blocks.config.ts`

```typescript
import { BlockData } from '@/lib/types/blocks';

// CENTRALIZED: All content in one place
export const plumbingBlocks = {
  categories: [
    {
      id: 1,
      name: 'Pipe Fittings',
      slug: 'pipe-fittings',
      image: 'https://images.unsplash.com/photo-1555001972-76611884af13',
      description: 'Copper, PEX, and steel fittings',
      productCount: 245
    },
    {
      id: 2,
      name: 'Valves & Controls',
      slug: 'valves-controls',
      image: 'https://images.unsplash.com/photo-1581166397057-235af2b3c6dd',
      description: 'Ball valves, gate valves, thermostatic',
      productCount: 189
    },
    {
      id: 3,
      name: 'Drainage',
      slug: 'drainage',
      image: 'https://images.unsplash.com/photo-1620825141088-a824daf6a46b',
      description: 'Pumps, drains, and waste systems',
      productCount: 156
    },
    {
      id: 4,
      name: 'Faucets',
      slug: 'faucets',
      image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4',
      description: 'Kitchen and bathroom fixtures',
      productCount: 312
    },
    {
      id: 5,
      name: 'Showers',
      slug: 'showers',
      image: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea',
      description: 'Columns, heads, and enclosures',
      productCount: 198
    },
    {
      id: 6,
      name: 'Bath Furniture',
      slug: 'bath-furniture',
      image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      description: 'Vanities, basins, and accessories',
      productCount: 276
    },
    {
      id: 7,
      name: 'Heating & Boilers',
      slug: 'heating-boilers',
      image: 'https://images.unsplash.com/photo-1588619461335-b81119fee1b5',
      description: 'Condensing boilers and radiators',
      productCount: 134
    },
    {
      id: 8,
      name: 'Sealants & Tape',
      slug: 'sealants-tape',
      image: 'https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec',
      description: 'Professional grade sealants',
      productCount: 89
    },
    {
      id: 9,
      name: 'Power Tools',
      slug: 'power-tools',
      image: 'https://images.unsplash.com/photo-1581166418878-11f0dde922c2',
      description: 'Press tools, drills, and cutters',
      productCount: 167
    },
    {
      id: 10,
      name: 'Service Kits',
      slug: 'service-kits',
      image: 'https://images.unsplash.com/photo-1654440122140-f1fc995ddb34',
      description: 'Complete job kits',
      productCount: 92
    }
  ],

  products: [
    {
      id: 1,
      name: 'ProPEX Expansion Tool Kit',
      slug: 'propex-expansion-tool-kit',
      price: 129.90,
      compareAt: 149.90,
      rating: 4.5,
      reviewCount: 47,
      image: 'https://images.unsplash.com/photo-1581166397057-235af2b3c6dd',
      category: 'power-tools',
      inStock: true,
      badges: ['sale', 'bestseller']
    },
    {
      id: 2,
      name: 'Thermostatic Shower Column',
      slug: 'thermostatic-shower-column',
      price: 499.00,
      compareAt: 549.00,
      rating: 4.5,
      reviewCount: 32,
      image: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea',
      category: 'showers',
      inStock: true,
      badges: ['sale', 'pro-choice']
    },
    {
      id: 3,
      name: 'Wall-Mounted Vanity Set',
      slug: 'wall-mounted-vanity-set',
      price: 899.00,
      compareAt: null,
      rating: 4.0,
      reviewCount: 18,
      image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      category: 'bath-furniture',
      inStock: true,
      badges: []
    },
    {
      id: 4,
      name: 'Stainless Work Basin & Faucet',
      slug: 'stainless-work-basin-faucet',
      price: 259.90,
      compareAt: 289.90,
      rating: 5,
      reviewCount: 64,
      image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4',
      category: 'faucets',
      inStock: true,
      badges: ['sale', 'bestseller']
    },
    {
      id: 5,
      name: 'High-Flow Sump Pump',
      slug: 'high-flow-sump-pump',
      price: 349.00,
      compareAt: null,
      rating: 4.5,
      reviewCount: 29,
      image: 'https://images.unsplash.com/photo-1620825141088-a824daf6a46b',
      category: 'drainage',
      inStock: true,
      badges: ['pro-choice']
    },
    {
      id: 6,
      name: 'Copper Press Fittings (50 pcs)',
      slug: 'copper-press-fittings-50',
      price: 189.00,
      compareAt: 209.00,
      rating: 4.5,
      reviewCount: 38,
      image: 'https://images.unsplash.com/photo-1555001972-76611884af13',
      category: 'pipe-fittings',
      inStock: true,
      badges: ['sale']
    },
    {
      id: 7,
      name: 'Condensing Boiler Maintenance Kit',
      slug: 'condensing-boiler-maintenance-kit',
      price: 129.00,
      compareAt: null,
      rating: 4,
      reviewCount: 22,
      image: 'https://images.unsplash.com/photo-1588619461335-b81119fee1b5',
      category: 'heating-boilers',
      inStock: true,
      badges: []
    },
    {
      id: 8,
      name: 'Pro Service Tool Roll',
      slug: 'pro-service-tool-roll',
      price: 89.90,
      compareAt: 99.90,
      rating: 4.5,
      reviewCount: 51,
      image: 'https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec',
      category: 'service-kits',
      inStock: true,
      badges: ['sale', 'bestseller']
    }
  ],

  posts: [
    {
      id: 1,
      title: 'How to spec the right valve for commercial jobs',
      slug: 'spec-valve-commercial-jobs',
      excerpt: 'Key pressure ratings, media compatibility, and install tips to help you choose the perfect valve every time.',
      image: 'https://images.unsplash.com/photo-1595345263387-c01f60e7c1b9',
      author: 'Mike Stevens',
      publishedAt: '2025-01-15',
      category: 'technical-guides'
    },
    {
      id: 2,
      title: 'Planning spa-like bathrooms clients will love',
      slug: 'spa-bathrooms-planning',
      excerpt: 'From concealed mixers to floating vanities, here\'s how installers elevate residential bath projects.',
      image: 'https://images.unsplash.com/photo-1487015307662-6ce6210680f1',
      author: 'Sarah Chen',
      publishedAt: '2025-01-12',
      category: 'design-tips'
    },
    {
      id: 3,
      title: 'Five must-have tools for rapid callouts',
      slug: 'emergency-tools-checklist',
      excerpt: 'A curated checklist to keep every emergency service van stocked and profitable.',
      image: 'https://images.unsplash.com/photo-1618373012585-ae012fc350e8',
      author: 'Tom Richards',
      publishedAt: '2025-01-08',
      category: 'business-tips'
    },
    {
      id: 4,
      title: 'Troubleshooting hydronic heating complaints',
      slug: 'hydronic-heating-troubleshooting',
      excerpt: 'Learn the diagnostic flow our pros follow before swapping pumps or controls.',
      image: 'https://images.unsplash.com/photo-1654440122140-f1fc995ddb34',
      author: 'Alex Kumar',
      publishedAt: '2025-01-05',
      category: 'technical-guides'
    }
  ],

  brands: [
    { id: 1, name: 'Milwaukee', logo: '/brands/milwaukee.svg' },
    { id: 2, name: 'Viega', logo: '/brands/viega.svg' },
    { id: 3, name: 'Grohe', logo: '/brands/grohe.svg' },
    { id: 4, name: 'Honeywell', logo: '/brands/honeywell.svg' },
    { id: 5, name: 'Ridgid', logo: '/brands/ridgid.svg' },
    { id: 6, name: 'Fernox', logo: '/brands/fernox.svg' }
  ]
};
```

### File: `config/templates/index.ts` (Template Registry)

```typescript
import { plumbingTemplate } from './plumbing/template.config';
import { plumbingBlocks } from './plumbing/blocks.config';

export const TEMPLATE_REGISTRY = {
  'plumbing-pro': {
    config: plumbingTemplate,
    blocks: plumbingBlocks
  }
  // Future templates:
  // 'electronics-store': { config: electronicsTemplate, blocks: electronicsBlocks },
  // 'fashion-boutique': { config: fashionTemplate, blocks: fashionBlocks },
};

// Helper functions
export function getTemplate(templateId: string) {
  return TEMPLATE_REGISTRY[templateId];
}

export function getAllTemplates() {
  return Object.entries(TEMPLATE_REGISTRY).map(([id, data]) => ({
    id,
    ...data.config
  }));
}
```

---

## 🧩 Phase 3: Create Reusable Block Components

All components extracted from App.tsx, but made configurable and SSR-compatible.

### File: `components/blocks/HeroSection/HeroSection.tsx`

```typescript
import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  variant: 'banner' | 'split' | 'grid' | 'carousel';
  title: string;
  subtitle?: string;
  cta?: {
    primary?: { text: string; link: string };
    secondary?: { text: string; link: string };
  };
  background?: {
    type: 'image' | 'video' | 'gradient';
    src?: string;
    alt?: string;
    overlay?: number;
  };
  height?: 'small' | 'medium' | 'large' | 'full';
  textAlign?: 'left' | 'center' | 'right';
  slides?: any[]; // For carousel variant
  gridItems?: any[]; // For grid variant
  splitImage?: string; // For split variant
}

export default function HeroSection({
  variant,
  title,
  subtitle,
  cta,
  background,
  height = 'large',
  textAlign = 'left',
  ...rest
}: HeroSectionProps) {
  switch (variant) {
    case 'banner':
      return <HeroBanner {...{ title, subtitle, cta, background, height, textAlign }} />;
    case 'split':
      return <HeroSplit {...{ title, subtitle, cta, ...rest }} />;
    case 'grid':
      return <HeroGrid {...rest} />;
    case 'carousel':
      return <HeroCarousel {...rest} />;
    default:
      return <HeroBanner {...{ title, subtitle, cta, background, height, textAlign }} />;
  }
}

// Individual variants (extracted from App.tsx)
function HeroBanner({ title, subtitle, cta, background, height, textAlign }) {
  const heightMap = {
    small: '40vh',
    medium: '50vh',
    large: '60vh',
    full: '100vh'
  };

  return (
    <section className="relative w-full overflow-hidden rounded-3xl" style={{ height: heightMap[height] }}>
      {background?.type === 'image' && (
        <>
          <Image
            src={background.src}
            alt={background.alt || title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          {background.overlay && (
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: background.overlay }}
            />
          )}
        </>
      )}

      <div className="relative z-10 h-full flex items-end">
        <div className="container mx-auto px-6 pb-10">
          <div className={`text-${textAlign} text-white max-w-xl`}>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 md:mt-3 text-white/90">{subtitle}</p>
            )}
            {cta && (
              <div className="mt-4 flex gap-3">
                {cta.primary && (
                  <Button asChild className="rounded-xl">
                    <a href={cta.primary.link}>{cta.primary.text}</a>
                  </Button>
                )}
                {cta.secondary && (
                  <Button asChild variant="secondary" className="rounded-xl">
                    <a href={cta.secondary.link}>{cta.secondary.text}</a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ... other variants (HeroSplit, HeroGrid, HeroCarousel)
```

---

## 🗄️ Phase 4: MongoDB Schema for Templates

### File: `models/Template.ts`

```typescript
import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema({
  _id: String,
  name: String,
  description: String,
  industry: String,
  version: String,

  branding: {
    storeName: String,
    logo: String,
    tagline: String,
    colors: {
      primary: String,
      secondary: String,
      accent: String,
      background: String,
      foreground: String
    },
    fonts: {
      heading: String,
      body: String
    }
  },

  layout: {
    header: mongoose.Schema.Types.Mixed,
    footer: mongoose.Schema.Types.Mixed
  },

  defaultBlocks: [{
    id: String,
    type: String,
    order: Number,
    config: mongoose.Schema.Types.Mixed
  }],

  seo: {
    title: String,
    description: String,
    keywords: [String],
    ogImage: String
  },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'templates'
});

TemplateSchema.index({ industry: 1, isActive: 1 });

export const Template = mongoose.model('Template', TemplateSchema);
```

### File: `models/TemplateData.ts` (Stores categories, products, etc.)

```typescript
import mongoose from 'mongoose';

const TemplateDataSchema = new mongoose.Schema({
  templateId: {
    type: String,
    required: true,
    ref: 'Template',
    index: true
  },
  dataType: {
    type: String,
    enum: ['categories', 'products', 'posts', 'brands'],
    required: true
  },
  items: [{
    type: mongoose.Schema.Types.Mixed
  }],
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'template_data'
});

TemplateDataSchema.index({ templateId: 1, dataType: 1 }, { unique: true });

export const TemplateData = mongoose.model('TemplateData', TemplateDataSchema);
```

---

## 🚀 Phase 5: Standard for Creating New Templates

### Step-by-Step Guide: Adding a New Template

#### 1. Create Template Directory

```bash
mkdir -p config/templates/electronics
```

#### 2. Copy Template Files

```bash
cp config/templates/plumbing/template.config.ts config/templates/electronics/
cp config/templates/plumbing/blocks.config.ts config/templates/electronics/
```

#### 3. Customize Configuration

**File: `config/templates/electronics/template.config.ts`**

```typescript
export const electronicsTemplate: TemplateConfig = {
  id: 'electronics-store',
  name: 'Electronics Store',
  description: 'Modern B2C storefront for electronics and gadgets',
  version: '1.0.0',
  industry: 'electronics',

  branding: {
    storeName: 'TechZone',
    logo: '/templates/electronics/logo.svg',
    tagline: 'Latest Tech, Best Prices',
    colors: {
      primary: '#10b981',      // Green
      secondary: '#3b82f6',    // Blue
      accent: '#f59e0b',       // Orange
      background: '#ffffff',
      foreground: '#0a0a0a'
    },
    fonts: {
      heading: 'Poppins',
      body: 'Inter'
    }
  },

  // Rest of config...
};
```

**File: `config/templates/electronics/blocks.config.ts`**

```typescript
export const electronicsBlocks = {
  categories: [
    {
      id: 1,
      name: 'Smartphones',
      slug: 'smartphones',
      image: '/categories/smartphones.jpg',
      description: 'Latest flagship devices',
      productCount: 156
    },
    // ... more categories
  ],

  products: [
    {
      id: 1,
      name: 'iPhone 15 Pro Max',
      slug: 'iphone-15-pro-max',
      price: 1199.00,
      // ... more fields
    },
    // ... more products
  ],

  // ... posts, brands
};
```

#### 4. Register Template

**File: `config/templates/index.ts`**

```typescript
import { electronicsTemplate } from './electronics/template.config';
import { electronicsBlocks } from './electronics/blocks.config';

export const TEMPLATE_REGISTRY = {
  'plumbing-pro': {
    config: plumbingTemplate,
    blocks: plumbingBlocks
  },
  'electronics-store': {  // NEW
    config: electronicsTemplate,
    blocks: electronicsBlocks
  }
};
```

#### 5. Done! Template is Ready

The same components will automatically work with the new template:
- Header adapts to new colors
- Hero sections use new images
- Products display electronics
- Categories show tech categories

---

## 📖 Summary: Benefits of This System

### ✅ What You Get

1. **Single Place for Configuration**
   - All template data in `config/templates/[name]/`
   - No code changes needed for new templates

2. **Reusable Components**
   - Same React components work for any template
   - Just pass different config props

3. **Easy to Create New Templates**
   - Copy existing template folder
   - Change configuration
   - Register in index.ts
   - Done in 30 minutes!

4. **Production Ready**
   - MongoDB stores templates
   - SSR for SEO
   - Admin CMS to edit templates
   - No rebuilds needed

5. **Scalable**
   - Add unlimited templates
   - Each with unique branding
   - Shared component library

### 🎯 Next Steps

1. Migrate current App.tsx to this structure
2. Create MongoDB schemas
3. Build admin interface
4. Deploy first template (plumbing)
5. Create second template to validate system
