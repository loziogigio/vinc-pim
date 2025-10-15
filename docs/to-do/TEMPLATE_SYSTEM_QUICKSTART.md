# Template System - Quick Start Guide

## 🎯 What We're Building

Transform your existing `vinc-storefront` (Vite + React) design into a **production CMS** where:
- ✅ Same components work for ANY business type
- ✅ Create new templates by only changing configuration files
- ✅ No code changes needed after initial setup
- ✅ All content in centralized config files
- ✅ MongoDB backend with SSR for SEO

---

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   EXISTING DESIGN                           │
│         vinc-storefront (Vite + React)                      │
│                                                             │
│  • Plumbing-specific hardcoded data                        │
│  • 4 Hero variants                                         │
│  • Product/Category/Blog sections                          │
│  • Control panel for preview                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              TRANSFORM TO TEMPLATE SYSTEM                   │
│                                                             │
│  1. Extract components → Make configurable                  │
│  2. Move all data → Centralized config files               │
│  3. Create template registry → Easy to add new ones        │
│  4. Add MongoDB → Store templates dynamically              │
│  5. Add admin CMS → Edit templates via UI                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 NEW ARCHITECTURE                            │
│                                                             │
│  config/templates/                                          │
│  ├── index.ts              ← Template Registry             │
│  ├── plumbing/             ← Template 1 (from your design) │
│  │   ├── template.config.ts  (branding, layout, SEO)      │
│  │   └── blocks.config.ts    (categories, products, etc)  │
│  ├── electronics/          ← Template 2 (future)           │
│  └── fashion/              ← Template 3 (future)           │
│                                                             │
│  components/blocks/                                         │
│  ├── HeroSection/          ← Reusable for ALL templates    │
│  ├── ProductSection/                                        │
│  ├── CategorySection/                                       │
│  └── ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Concept: Configuration-Driven Design

### BEFORE (Hardcoded)
```typescript
// App.tsx - Plumbing specific, hardcoded
const categories = [
  { id: 1, name: "Pipe Fittings", image: "..." },
  { id: 2, name: "Valves", image: "..." }
];

<CategoryGrid categories={categories} />
```

### AFTER (Template-Based)
```typescript
// config/templates/plumbing/blocks.config.ts
export const plumbingBlocks = {
  categories: [
    { id: 1, name: "Pipe Fittings", image: "..." },
    { id: 2, name: "Valves", image: "..." }
  ]
};

// config/templates/electronics/blocks.config.ts
export const electronicsBlocks = {
  categories: [
    { id: 1, name: "Smartphones", image: "..." },
    { id: 2, name: "Laptops", image: "..." }
  ]
};

// Component (same for both!)
<CategoryGrid categories={currentTemplate.blocks.categories} />
```

---

## 📁 File Structure You'll Create

```
vinc-apps/
├── vinc-storefront/                    # KEEP: Your existing Vite app
│   └── src/App.tsx                     # Will extract from here
│
├── vinc-cms/                           # NEW: Production CMS
│   ├── config/
│   │   ├── templates/
│   │   │   ├── index.ts                # Registry of all templates
│   │   │   │
│   │   │   ├── plumbing/               # Template 1 (your current design)
│   │   │   │   ├── template.config.ts  # Branding, colors, layout
│   │   │   │   └── blocks.config.ts    # Categories, products, posts
│   │   │   │
│   │   │   ├── electronics/            # Template 2 (copy & customize)
│   │   │   │   ├── template.config.ts
│   │   │   │   └── blocks.config.ts
│   │   │   │
│   │   │   └── fashion/                # Template 3 (copy & customize)
│   │   │       ├── template.config.ts
│   │   │       └── blocks.config.ts
│   │   │
│   │   ├── blocks.config.ts            # Global block definitions
│   │   ├── theme.config.ts             # Global theme settings
│   │   └── seo.config.ts               # Global SEO defaults
│   │
│   ├── components/
│   │   ├── blocks/                     # Extracted from App.tsx
│   │   │   ├── HeroSection/
│   │   │   │   ├── HeroSection.tsx     # Main component
│   │   │   │   ├── HeroBanner.tsx      # Variant 1
│   │   │   │   ├── HeroSplit.tsx       # Variant 2
│   │   │   │   ├── HeroGrid.tsx        # Variant 3
│   │   │   │   └── HeroCarousel.tsx    # Variant 4
│   │   │   ├── ProductSection/
│   │   │   │   ├── ProductSection.tsx
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   └── ProductSlider.tsx
│   │   │   ├── CategorySection/
│   │   │   │   ├── CategorySection.tsx
│   │   │   │   ├── CategoryGrid.tsx
│   │   │   │   └── CategoryScroller.tsx
│   │   │   ├── ContentSection/
│   │   │   │   ├── ContentSection.tsx
│   │   │   │   └── BlogCard.tsx
│   │   │   ├── BrandSection/
│   │   │   │   └── BrandGrid.tsx
│   │   │   ├── HeaderSection/
│   │   │   │   └── Header.tsx
│   │   │   └── FooterSection/
│   │   │       └── Footer.tsx
│   │   │
│   │   ├── builder/                    # Admin CMS UI
│   │   │   ├── TemplateSelector.tsx
│   │   │   ├── BlockEditor.tsx
│   │   │   └── PreviewPanel.tsx
│   │   │
│   │   └── renderer/
│   │       └── ServerBlockRenderer.tsx # SSR renderer
│   │
│   ├── app/                            # Next.js App Router
│   │   ├── (public)/
│   │   │   └── [template]/
│   │   │       └── page.tsx            # Dynamic template routes
│   │   │
│   │   └── admin/
│   │       └── templates/
│   │           └── page.tsx            # Template management
│   │
│   ├── models/                         # MongoDB schemas
│   │   ├── Template.ts
│   │   ├── TemplateData.ts
│   │   └── Page.ts
│   │
│   └── lib/
│       ├── db/
│       │   ├── mongodb.ts              # Connection
│       │   └── templates.ts            # CRUD operations
│       └── templates/
│           └── resolver.ts             # Template resolution logic
│
└── doc/
    ├── FRONTSHOP_VINC.MD                      # Original implementation
    ├── TEMPLATE_SYSTEM_IMPLEMENTATION.md      # Detailed guide
    └── TEMPLATE_SYSTEM_QUICKSTART.md          # This file
```

---

## 🚀 Implementation Steps

### Step 1: Create Config Structure (30 min)

```bash
cd vinc-apps
mkdir -p vinc-cms/config/templates/plumbing
```

Create these files:

**`vinc-cms/config/templates/plumbing/template.config.ts`**
```typescript
export const plumbingTemplate = {
  id: 'plumbing-pro',
  name: 'VINC Trade Supply',
  branding: {
    storeName: 'VINC Trade Supply',
    colors: {
      primary: '#2563eb',
      secondary: '#7c3aed'
    }
  },
  defaultBlocks: [
    { id: 'hero-1', type: 'hero-banner', order: 0, config: {...} },
    { id: 'products-1', type: 'product-slider', order: 1, config: {...} }
  ]
};
```

**`vinc-cms/config/templates/plumbing/blocks.config.ts`**
```typescript
export const plumbingBlocks = {
  categories: [
    { id: 1, name: 'Pipe Fittings', image: '...', slug: 'pipe-fittings' }
    // Copy from your current App.tsx
  ],
  products: [
    { id: 1, name: 'ProPEX Tool Kit', price: 129.90, image: '...' }
    // Copy from your current App.tsx
  ],
  posts: [...]
};
```

### Step 2: Extract Components (2-3 hours)

Move each section from `App.tsx` to individual component files:

```typescript
// components/blocks/HeroSection/HeroSection.tsx
export default function HeroSection({ variant, title, subtitle, cta, background }) {
  switch (variant) {
    case 'banner': return <HeroBanner {...props} />;
    case 'split': return <HeroSplit {...props} />;
    case 'grid': return <HeroGrid {...props} />;
    case 'carousel': return <HeroCarousel {...props} />;
  }
}
```

### Step 3: Create Template Registry (15 min)

**`vinc-cms/config/templates/index.ts`**
```typescript
import { plumbingTemplate } from './plumbing/template.config';
import { plumbingBlocks } from './plumbing/blocks.config';

export const TEMPLATE_REGISTRY = {
  'plumbing-pro': {
    config: plumbingTemplate,
    blocks: plumbingBlocks
  }
};

export function getTemplate(id: string) {
  return TEMPLATE_REGISTRY[id];
}
```

### Step 4: MongoDB Setup (30 min)

```bash
npm install mongoose mongodb
```

**`.env.local`**
```bash
VINC_MONGO_URL=mongodb://admin:admin@localhost:27017/?authSource=admin
VINC_MONGO_DB=app
```

**`models/Template.ts`**
```typescript
import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema({
  _id: String,
  name: String,
  branding: Object,
  defaultBlocks: Array,
  // ... rest from doc
});

export const Template = mongoose.model('Template', TemplateSchema);
```

### Step 5: Create SSR Page (1 hour)

**`app/[template]/page.tsx`**
```typescript
import { getTemplate } from '@/config/templates';
import { ServerBlockRenderer } from '@/components/renderer/ServerBlockRenderer';

export default async function TemplatePage({ params }: { params: { template: string } }) {
  const template = getTemplate(params.template);

  return (
    <main>
      {template.config.defaultBlocks.map(block => (
        <ServerBlockRenderer key={block.id} block={block} data={template.blocks} />
      ))}
    </main>
  );
}
```

---

## ✅ Result: Adding New Templates is EASY

### To create an "Electronics Store" template:

```bash
# 1. Copy plumbing template
cp -r config/templates/plumbing config/templates/electronics

# 2. Edit template.config.ts (change branding, colors)
# 3. Edit blocks.config.ts (change categories, products to electronics)
# 4. Register in index.ts
# 5. Done! Visit /electronics to see it live
```

**Time to create new template: 30 minutes**

---

## 🎨 How It Works

### Same Component, Different Data

```typescript
// Plumbing template
<HeroSection
  variant="banner"
  title="Trade-Ready Plumbing Supply"
  background={{ src: '/plumbing-hero.jpg' }}
/>

// Electronics template (same component!)
<HeroSection
  variant="banner"
  title="Latest Tech, Best Prices"
  background={{ src: '/electronics-hero.jpg' }}
/>
```

### Template Resolution Flow

```
1. User visits → /plumbing
2. Next.js calls → getTemplate('plumbing')
3. System loads → config/templates/plumbing/template.config.ts
4. System loads → config/templates/plumbing/blocks.config.ts
5. Renders page → Using shared components with plumbing data
6. SEO rendered → Server-side for Google
```

---

## 📈 Benefits Summary

| Feature | Before | After |
|---------|--------|-------|
| Add new template | Code entire app | Copy config (30 min) |
| Change branding | Edit components | Edit config file |
| Update products | Redeploy app | Edit MongoDB |
| SEO | Client-side React | Server-side Next.js |
| Scalability | Limited | Unlimited templates |

---

## 🎯 Next Actions

1. ✅ Read TEMPLATE_SYSTEM_IMPLEMENTATION.md for details
2. ⏳ Start with Step 1: Create config structure
3. ⏳ Extract components from App.tsx
4. ⏳ Setup MongoDB
5. ⏳ Test with plumbing template
6. ⏳ Create second template (electronics) to validate system

**Estimated time: 1-2 days for initial setup, then 30 min per new template**
