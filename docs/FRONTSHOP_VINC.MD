# Next.js E-Commerce Drag & Drop CMS - Production Implementation Guide

## 🎯 Overview

Build a **production-ready, SEO-optimized** drag-and-drop page builder for Next.js e-commerce with server-side rendering (SSR), centralized configuration management, and reusable component architecture for B2C applications.

### Key Production Features

- **SEO-First Architecture**: Full server-side rendering with metadata generation
- **Centralized Config Management**: Single source of truth for all page parameters
- **Template-Based System**: Consistent components with configurable styling/content
- **MongoDB Database**: Flexible schema-less storage perfect for dynamic block configurations
- **Performance Optimized**: Image optimization, lazy loading, and caching strategies
- **Type-Safe**: Full TypeScript coverage with strict validation
- **Production Security**: Input sanitization, CSRF protection, rate limiting

### Quick Start - MongoDB Setup

```bash
# 1. Install dependencies
npm install mongoose mongodb

# 2. Add to .env.local
VINC_MONGO_URL=mongodb://admin:admin@localhost:27017/?authSource=admin
VINC_MONGO_DB=app
VINC_MONGO_MIN_POOL_SIZE=0
VINC_MONGO_MAX_POOL_SIZE=100

# 3. Connection pooling configured automatically
# 4. Collections created on first write
# 5. No migrations needed - schema-less!
```

---

## 📦 Technology Stack

### Core Libraries (Production-Ready)

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "react": "^18.3.0",
    "next": "^14.2.0",
    "tailwindcss": "^3.4.0",
    "framer-motion": "^11.0.0",
    "zustand": "^4.5.0",
    "zod": "^3.22.0",
    "sharp": "^0.33.0",
    "@vercel/og": "^0.6.0",
    "iron-session": "^8.0.0",
    "helmet": "^7.1.0",
    "rate-limiter-flexible": "^4.0.0",
    "dompurify": "^3.0.0",
    "isomorphic-dompurify": "^2.0.0",
    "mongoose": "^8.0.0",
    "mongodb": "^6.3.0"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.0",
    "@types/mongoose": "^8.0.0"
  }
}
```

**Production Stack Rationale:**

- **@dnd-kit**: Touch-friendly, accessible, performant drag-and-drop
- **Zod**: Runtime type validation for API security
- **Sharp**: High-performance image processing
- **iron-session**: Secure, stateless session management
- **rate-limiter-flexible**: API rate limiting protection
- **DOMPurify**: XSS protection for user-generated content
- **Mongoose**: MongoDB ODM with schema validation and middleware
- **MongoDB**: NoSQL database - perfect for flexible JSON block structures

---

## 🏗️ Production Architecture (SEO & Reusability First)

```
/app
  /admin
    /page-builder
      page.tsx              # Builder interface (CSR)
      layout.tsx            # Admin layout with auth
  /(public)
    /page.tsx               # SSR homepage with SEO metadata
    /[...slug]
      page.tsx              # Dynamic SSR pages
    /layout.tsx             # Root layout with global SEO
  /api
    /pages
      /[slug]
        route.ts            # GET page config
      /save
        route.ts            # POST save page (with validation)
    /seo
      /generate
        route.ts            # Generate dynamic sitemaps/metadata

/components
  /blocks                   # REUSABLE block components
    /HeroSection           # Template-based approach
      HeroSection.tsx       # Core component
      variants.ts           # Visual variants (full-width, split, etc.)
      schema.ts             # Zod validation schema
      defaults.ts           # Default configurations
    /ProductSection
      ProductSection.tsx
      variants.ts
      schema.ts
      defaults.ts
    /CategorySection
      CategorySection.tsx
      variants.ts
      schema.ts
      defaults.ts
    /ContentSection
      ContentSection.tsx
      variants.ts
      schema.ts
      defaults.ts
  /builder                  # Admin-only components
    BlockLibrary.tsx        # Block catalog
    Canvas.tsx              # Drag-drop zone
    BlockWrapper.tsx        # Editor controls
    BlockSettings.tsx       # Configuration panel
  /renderer
    BlockRenderer.tsx       # SSR-compatible renderer
    ServerBlockRenderer.tsx # Server component wrapper

/lib
  /config
    blockTemplates.ts       # CENTRALIZED block templates
    seoDefaults.ts          # Default SEO settings
    imageConfig.ts          # Image optimization rules
  /store
    pageBuilderStore.ts     # Admin state (client-side only)
  /types
    blocks.ts               # Shared TypeScript types
    seo.ts                  # SEO metadata types
  /validation
    blockSchemas.ts         # Zod validation schemas
    sanitizers.ts           # XSS protection utilities
  /seo
    metadataGenerator.ts    # Dynamic metadata generation
    structuredData.ts       # JSON-LD schema.org markup
    sitemap.ts              # Dynamic sitemap generation
  /utils
    configResolver.ts       # Resolve configs from templates
    ssrHelpers.ts           # Server-side utilities
  /db
    pages.ts                # Database operations
    cache.ts                # Redis/caching layer

/config
  blocks.config.ts          # CENTRALIZED: All block configurations
  theme.config.ts           # CENTRALIZED: Theme/design tokens
  seo.config.ts             # CENTRALIZED: SEO settings
```

### Architecture Principles

1. **Centralized Configuration**: All block templates, defaults, and variations in `/lib/config`
2. **Template-Based Components**: Consistent base components with variant props
3. **SSR for Public Pages**: All B2C pages rendered server-side for SEO
4. **Separation of Concerns**: Admin tools (CSR) vs public pages (SSR)
5. **Type Safety**: Zod schemas validate all configurations at runtime

---

## 🎛️ Centralized Configuration Management (NEW)

### Overview: Template-Based Configuration System

All block configurations, defaults, and variants are managed in centralized config files. This ensures:
- **Single Source of Truth**: Change once, reflect everywhere
- **Consistency**: Same component, different styling/content
- **Type Safety**: Validated configurations at compile and runtime
- **Easy Updates**: No code changes needed for content updates

### File: `config/blocks.config.ts` (CENTRALIZED BLOCK DEFINITIONS)

```typescript
import { z } from 'zod';

// Define all available block variants in one place
export const BLOCK_REGISTRY = {
  hero: {
    id: 'hero',
    name: 'Hero Section',
    category: 'headers',
    variants: {
      fullWidth: {
        id: 'hero-full-width',
        label: 'Full Width Hero',
        icon: '🖼️',
        defaultConfig: {
          variant: 'fullWidth',
          title: 'Welcome to Our Store',
          subtitle: 'Discover amazing products',
          cta: {
            text: 'Shop Now',
            link: '/shop',
            style: 'primary'
          },
          background: {
            type: 'image',
            src: '/images/hero-default.jpg',
            alt: 'Hero background'
          },
          textAlign: 'center',
          height: 'large',
          overlay: 0.3
        }
      },
      split: {
        id: 'hero-split',
        label: 'Split Hero',
        icon: '📱',
        defaultConfig: {
          variant: 'split',
          title: 'New Collection',
          subtitle: 'Spring 2025',
          cta: { text: 'Explore', link: '/collection/spring' },
          image: '/images/hero-split.jpg',
          imagePosition: 'right',
          backgroundColor: '#f8f9fa'
        }
      },
      carousel: {
        id: 'hero-carousel',
        label: 'Carousel Hero',
        icon: '🎠',
        defaultConfig: {
          variant: 'carousel',
          slides: [
            {
              title: 'Slide 1',
              subtitle: 'Description',
              cta: { text: 'Learn More', link: '#' },
              image: '/images/slide1.jpg'
            }
          ],
          autoplay: true,
          interval: 5000,
          showDots: true,
          showArrows: true
        }
      }
    }
  },

  product: {
    id: 'product',
    name: 'Product Section',
    category: 'commerce',
    variants: {
      slider: {
        id: 'product-slider',
        label: 'Product Slider',
        icon: '🛍️',
        defaultConfig: {
          variant: 'slider',
          title: 'Featured Products',
          subtitle: '',
          collection: 'best-sellers',
          limit: 8,
          columns: { mobile: 2, tablet: 3, desktop: 4 },
          showBadges: true,
          showQuickAdd: true,
          slidesPerView: 4,
          spaceBetween: 24
        }
      },
      grid: {
        id: 'product-grid',
        label: 'Product Grid',
        icon: '📦',
        defaultConfig: {
          variant: 'grid',
          title: 'Shop All',
          collection: 'all',
          limit: 12,
          columns: { mobile: 2, tablet: 3, desktop: 4 },
          showFilters: true,
          showSort: true,
          pagination: 'infinite-scroll'
        }
      }
    }
  },

  category: {
    id: 'category',
    name: 'Category Section',
    category: 'navigation',
    variants: {
      grid: {
        id: 'category-grid',
        label: 'Category Grid',
        icon: '📑',
        defaultConfig: {
          variant: 'grid',
          title: 'Shop by Category',
          categories: [],
          layout: 'grid',
          columns: { mobile: 2, tablet: 3, desktop: 4 },
          showImage: true,
          showCount: true,
          imageAspectRatio: '1:1'
        }
      },
      carousel: {
        id: 'category-carousel',
        label: 'Category Carousel',
        icon: '🎪',
        defaultConfig: {
          variant: 'carousel',
          title: 'Browse Categories',
          categories: [],
          slidesPerView: 5,
          showImage: true
        }
      }
    }
  },

  content: {
    id: 'content',
    name: 'Content Section',
    category: 'content',
    variants: {
      richText: {
        id: 'content-rich-text',
        label: 'Rich Text',
        icon: '📝',
        defaultConfig: {
          variant: 'richText',
          content: '<p>Add your content here</p>',
          width: 'contained',
          textAlign: 'left',
          padding: 'medium'
        }
      },
      features: {
        id: 'content-features',
        label: 'Feature Grid',
        icon: '⭐',
        defaultConfig: {
          variant: 'features',
          title: 'Why Choose Us',
          features: [
            {
              icon: '🚚',
              title: 'Free Shipping',
              description: 'On orders over $50'
            },
            {
              icon: '🔒',
              title: 'Secure Payment',
              description: '100% secure transactions'
            }
          ],
          columns: { mobile: 1, tablet: 2, desktop: 3 }
        }
      },
      testimonials: {
        id: 'content-testimonials',
        label: 'Testimonials',
        icon: '💬',
        defaultConfig: {
          variant: 'testimonials',
          title: 'What Our Customers Say',
          testimonials: [],
          layout: 'carousel',
          showRating: true,
          showAvatar: true
        }
      }
    }
  }
};

// Helper to get all block templates as flat array
export const getAllBlockTemplates = () => {
  return Object.values(BLOCK_REGISTRY).flatMap(section =>
    Object.values(section.variants)
  );
};

// Helper to get block template by ID
export const getBlockTemplate = (blockId: string) => {
  for (const section of Object.values(BLOCK_REGISTRY)) {
    const variant = Object.values(section.variants).find(v => v.id === blockId);
    if (variant) return variant;
  }
  return null;
};
```

### File: `config/theme.config.ts` (CENTRALIZED DESIGN TOKENS)

```typescript
// All design tokens in one place
export const THEME_CONFIG = {
  colors: {
    primary: {
      main: '#2563eb',
      hover: '#1d4ed8',
      light: '#dbeafe',
      dark: '#1e40af'
    },
    secondary: {
      main: '#7c3aed',
      hover: '#6d28d9',
      light: '#ede9fe',
      dark: '#5b21b6'
    },
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      // ... rest of palette
    }
  },

  typography: {
    fonts: {
      sans: 'Inter, system-ui, sans-serif',
      serif: 'Georgia, serif',
      mono: 'Menlo, monospace'
    },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem'
    }
  },

  spacing: {
    section: {
      small: '2rem',
      medium: '4rem',
      large: '6rem',
      xlarge: '8rem'
    },
    container: {
      mobile: '1rem',
      tablet: '2rem',
      desktop: '4rem'
    }
  },

  breakpoints: {
    mobile: 640,
    tablet: 768,
    desktop: 1024,
    wide: 1280,
    ultrawide: 1536
  }
};
```

### File: `config/seo.config.ts` (CENTRALIZED SEO SETTINGS)

```typescript
export const SEO_CONFIG = {
  defaultMetadata: {
    siteName: 'Your E-Commerce Store',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
    defaultTitle: 'Premium Products | Your Store',
    titleTemplate: '%s | Your Store',
    defaultDescription: 'Discover premium products at unbeatable prices.',
    defaultKeywords: ['e-commerce', 'online shopping', 'products'],
    defaultImage: '/images/og-default.jpg',
    twitterHandle: '@yourstore',
    locale: 'en_US'
  },

  structuredData: {
    organization: {
      '@type': 'Organization',
      name: 'Your Store',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      sameAs: [
        'https://facebook.com/yourstore',
        'https://twitter.com/yourstore',
        'https://instagram.com/yourstore'
      ]
    }
  },

  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1
  }
};
```

### How This System Works

```typescript
// Admin: User selects "Hero - Full Width" from block library
// System resolves configuration from centralized config
import { getBlockTemplate } from '@/config/blocks.config';

const template = getBlockTemplate('hero-full-width');
const newBlock = {
  id: uuid(),
  type: template.id,
  order: 0,
  config: template.defaultConfig, // Pre-filled with defaults
  metadata: {
    templateVersion: '1.0',
    createdAt: new Date().toISOString()
  }
};

// Public: Page renders with SSR
// Component receives resolved config and renders consistently
<HeroSection
  variant="fullWidth"
  title="Welcome to Our Store"
  subtitle="Discover amazing products"
  {...resolvedConfig}
/>
```

---

## 🔍 SEO Implementation (Server-Side Rendering)

### File: `app/(public)/page.tsx` (SSR Homepage with SEO)

```typescript
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServerBlockRenderer } from '@/components/renderer/ServerBlockRenderer';
import { generatePageMetadata } from '@/lib/seo/metadataGenerator';
import { generateStructuredData } from '@/lib/seo/structuredData';
import { getPageConfig } from '@/lib/db/pages';

// IMPORTANT: This is a SERVER COMPONENT for SEO
export const revalidate = 300; // ISR: Revalidate every 5 minutes

// Generate dynamic metadata (SEO tags)
export async function generateMetadata(): Promise<Metadata> {
  const pageConfig = await getPageConfig('home');

  if (!pageConfig) {
    return {
      title: 'Page Not Found'
    };
  }

  return generatePageMetadata(pageConfig);
}

export default async function HomePage() {
  const pageConfig = await getPageConfig('home');

  if (!pageConfig) {
    notFound();
  }

  // Generate JSON-LD structured data for SEO
  const structuredData = generateStructuredData(pageConfig);

  return (
    <>
      {/* Structured Data (Schema.org) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Server-rendered blocks */}
      <main>
        {pageConfig.blocks
          .sort((a, b) => a.order - b.order)
          .map((block) => (
            <ServerBlockRenderer key={block.id} block={block} />
          ))}
      </main>
    </>
  );
}
```

### File: `lib/seo/metadataGenerator.ts` (Dynamic SEO Metadata)

```typescript
import { Metadata } from 'next';
import { SEO_CONFIG } from '@/config/seo.config';
import { PageConfig } from '@/lib/types/blocks';

export function generatePageMetadata(pageConfig: PageConfig): Metadata {
  const { seo } = pageConfig;
  const config = SEO_CONFIG.defaultMetadata;

  // Extract first hero block for OG image
  const heroBlock = pageConfig.blocks.find(b => b.type.startsWith('hero'));
  const ogImage = seo?.image || heroBlock?.config?.background?.src || config.defaultImage;

  return {
    title: seo?.title || config.defaultTitle,
    description: seo?.description || config.defaultDescription,
    keywords: seo?.keywords || config.defaultKeywords,

    // Open Graph (Facebook, LinkedIn)
    openGraph: {
      type: 'website',
      siteName: config.siteName,
      title: seo?.ogTitle || seo?.title || config.defaultTitle,
      description: seo?.ogDescription || seo?.description || config.defaultDescription,
      url: `${config.siteUrl}${pageConfig.slug === 'home' ? '' : `/${pageConfig.slug}`}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: seo?.title || config.defaultTitle
        }
      ],
      locale: config.locale
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      site: config.twitterHandle,
      title: seo?.twitterTitle || seo?.title || config.defaultTitle,
      description: seo?.twitterDescription || seo?.description || config.defaultDescription,
      images: [ogImage]
    },

    // Robots
    robots: {
      index: seo?.noIndex ? false : SEO_CONFIG.robots.index,
      follow: seo?.noFollow ? false : SEO_CONFIG.robots.follow,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    },

    // Canonical URL
    alternates: {
      canonical: seo?.canonicalUrl || `${config.siteUrl}${pageConfig.slug === 'home' ? '' : `/${pageConfig.slug}`}`
    }
  };
}
```

### File: `lib/seo/structuredData.ts` (Schema.org Markup)

```typescript
import { PageConfig } from '@/lib/types/blocks';
import { SEO_CONFIG } from '@/config/seo.config';

export function generateStructuredData(pageConfig: PageConfig) {
  const config = SEO_CONFIG.defaultMetadata;

  const structuredData: any[] = [
    // Organization Schema
    {
      '@context': 'https://schema.org',
      ...SEO_CONFIG.structuredData.organization
    },

    // WebSite Schema
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.siteName,
      url: config.siteUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${config.siteUrl}/search?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    },

    // WebPage Schema
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pageConfig.seo?.title || pageConfig.title,
      description: pageConfig.seo?.description,
      url: `${config.siteUrl}${pageConfig.slug === 'home' ? '' : `/${pageConfig.slug}`}`,
      isPartOf: {
        '@type': 'WebSite',
        url: config.siteUrl
      }
    }
  ];

  // Add Product schema if page has product blocks
  const productBlocks = pageConfig.blocks.filter(b => b.type.startsWith('product'));
  if (productBlocks.length > 0) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [] // Populate with actual products in production
    });
  }

  // Add BreadcrumbList if applicable
  if (pageConfig.slug !== 'home') {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: config.siteUrl
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: pageConfig.title,
          item: `${config.siteUrl}/${pageConfig.slug}`
        }
      ]
    });
  }

  return structuredData;
}
```

### File: `app/sitemap.ts` (Dynamic Sitemap Generation)

```typescript
import { MetadataRoute } from 'next';
import { getAllPublishedPages } from '@/lib/db/pages';
import { SEO_CONFIG } from '@/config/seo.config';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SEO_CONFIG.defaultMetadata.siteUrl;
  const pages = await getAllPublishedPages();

  return pages.map((page) => ({
    url: `${baseUrl}${page.slug === 'home' ? '' : `/${page.slug}`}`,
    lastModified: new Date(page.updatedAt),
    changeFrequency: page.changeFrequency || 'weekly',
    priority: page.slug === 'home' ? 1.0 : 0.8
  }));
}
```

### File: `app/robots.ts` (Robots.txt)

```typescript
import { MetadataRoute } from 'next';
import { SEO_CONFIG } from '@/config/seo.config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SEO_CONFIG.defaultMetadata.siteUrl;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/_next/', '/preview/']
    },
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
```

---

## 📊 Data Structure (Updated for Production)

### Enhanced Page Configuration JSON

```json
{
  "id": "home-page-v1",
  "title": "Home Page",
  "slug": "home",
  "status": "published",

  "seo": {
    "title": "Premium Products - Shop the Best Deals | Your Store",
    "description": "Discover our curated collection of premium products at unbeatable prices. Free shipping on orders over $50.",
    "keywords": ["e-commerce", "online shopping", "premium products", "best deals"],
    "ogTitle": "Shop Premium Products Online",
    "ogDescription": "Explore our exclusive collection",
    "ogImage": "/images/og-home.jpg",
    "twitterTitle": "Your Store - Premium Products",
    "twitterDescription": "Shop the best deals today",
    "canonicalUrl": "https://example.com",
    "noIndex": false,
    "noFollow": false
  },

  "blocks": [
    {
      "id": "block-1",
      "type": "hero-carousel",
      "order": 0,
      "config": {
        "variant": "carousel",
        "slides": [
          {
            "title": "Summer Collection 2025",
            "subtitle": "Up to 50% Off Selected Items",
            "cta": {
              "text": "Shop Now",
              "link": "/collections/summer",
              "style": "primary"
            },
            "background": {
              "type": "image",
              "src": "/images/hero1.jpg",
              "alt": "Summer collection banner",
              "priority": true
            },
            "overlay": 0.3,
            "textAlign": "center"
          }
        ],
        "autoplay": true,
        "interval": 5000,
        "showDots": true,
        "showArrows": true
      },
      "metadata": {
        "templateId": "hero-carousel",
        "templateVersion": "1.0"
      }
    },
    {
      "id": "block-2",
      "type": "product-slider",
      "order": 1,
      "config": {
        "variant": "slider",
        "title": "Best Sellers",
        "subtitle": "Customer favorites this month",
        "collection": "best-sellers",
        "limit": 8,
        "columns": {
          "mobile": 2,
          "tablet": 3,
          "desktop": 4
        },
        "showBadges": true,
        "showQuickAdd": true,
        "slidesPerView": 4,
        "spaceBetween": 24,
        "lazyLoad": true
      },
      "metadata": {
        "templateId": "product-slider",
        "templateVersion": "1.0"
      }
    },
    {
      "id": "block-3",
      "type": "category-grid",
      "order": 2,
      "config": {
        "variant": "grid",
        "title": "Shop by Category",
        "categories": [
          {
            "id": "electronics",
            "name": "Electronics",
            "image": "/images/cat-electronics.jpg",
            "link": "/category/electronics"
          },
          {
            "id": "fashion",
            "name": "Fashion",
            "image": "/images/cat-fashion.jpg",
            "link": "/category/fashion"
          }
        ],
        "layout": "grid",
        "columns": {
          "mobile": 2,
          "tablet": 3,
          "desktop": 4
        },
        "showImage": true,
        "showCount": true,
        "imageAspectRatio": "1:1"
      },
      "metadata": {
        "templateId": "category-grid",
        "templateVersion": "1.0"
      }
    }
  ],

  "settings": {
    "cache": {
      "enabled": true,
      "ttl": 300,
      "strategy": "stale-while-revalidate"
    },
    "analytics": {
      "trackPageView": true,
      "trackBlockViews": true
    }
  },

  "metadata": {
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-20T14:30:00Z",
    "publishedAt": "2025-01-20T15:00:00Z",
    "author": "admin@store.com",
    "version": 3,
    "changeFrequency": "weekly"
  }
}
```

### TypeScript Interfaces (Production-Ready)

```typescript
// lib/types/blocks.ts

export type BlockType =
  | 'hero-full-width'
  | 'hero-split'
  | 'hero-carousel'
  | 'hero-grid'
  | 'product-slider'
  | 'product-grid'
  | 'category-grid'
  | 'category-carousel'
  | 'content-rich-text'
  | 'content-features'
  | 'content-testimonials'
  | 'blog-section'
  | 'brand-logos';

export interface BaseBlock {
  id: string;
  type: BlockType;
  order: number;
  config: Record<string, any>;
  metadata: {
    templateId: string;
    templateVersion: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

export interface PageSettings {
  cache: {
    enabled: boolean;
    ttl: number;
    strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  };
  analytics: {
    trackPageView: boolean;
    trackBlockViews: boolean;
  };
}

export interface PageConfig {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  seo: SEOMetadata;
  blocks: BaseBlock[];
  settings: PageSettings;
  metadata: {
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    author: string;
    version: number;
    changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  };
}

// lib/types/seo.ts

export interface StructuredDataOrganization {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  logo: string;
  sameAs: string[];
  contactPoint?: {
    '@type': 'ContactPoint';
    telephone: string;
    contactType: string;
  };
}

export interface StructuredDataProduct {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  image: string[];
  description: string;
  sku: string;
  brand: {
    '@type': 'Brand';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    url: string;
    priceCurrency: string;
    price: number;
    availability: string;
  };
}

export interface StructuredDataBreadcrumb {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}
```

---

## 🧩 Reusable Component Architecture (Template-Based)

### Component Structure: Same Base, Different Variants

All blocks follow this pattern for maximum reusability:

```typescript
// components/blocks/HeroSection/HeroSection.tsx
import Image from 'next/image';
import { THEME_CONFIG } from '@/config/theme.config';
import { sanitizeHtml } from '@/lib/validation/sanitizers';

interface HeroSectionProps {
  variant: 'fullWidth' | 'split' | 'carousel' | 'grid';
  title: string;
  subtitle?: string;
  cta?: {
    text: string;
    link: string;
    style: 'primary' | 'secondary' | 'outline';
  };
  background?: {
    type: 'image' | 'video' | 'color';
    src?: string;
    alt?: string;
    priority?: boolean;
  };
  overlay?: number;
  textAlign?: 'left' | 'center' | 'right';
  height?: 'small' | 'medium' | 'large' | 'full';
  [key: string]: any; // Additional variant-specific props
}

export default function HeroSection({
  variant,
  title,
  subtitle,
  cta,
  background,
  overlay = 0.3,
  textAlign = 'center',
  height = 'large',
  ...rest
}: HeroSectionProps) {
  // Resolve height from theme config
  const heightMap = {
    small: '400px',
    medium: '600px',
    large: '800px',
    full: '100vh'
  };

  const baseClasses = 'relative w-full overflow-hidden';
  const heightClass = `h-[${heightMap[height]}]`;

  // Render different variants using the same component
  switch (variant) {
    case 'fullWidth':
      return <FullWidthHero {...{ title, subtitle, cta, background, overlay, textAlign, height }} />;

    case 'split':
      return <SplitHero {...{ title, subtitle, cta, ...rest }} />;

    case 'carousel':
      return <CarouselHero {...rest} />;

    default:
      return <FullWidthHero {...{ title, subtitle, cta, background, overlay, textAlign, height }} />;
  }
}

// Sub-components (variants) - all use shared utilities
function FullWidthHero({ title, subtitle, cta, background, overlay, textAlign, height }) {
  return (
    <section className="relative w-full" style={{ height }}>
      {/* Background Image */}
      {background?.type === 'image' && (
        <>
          <Image
            src={background.src}
            alt={background.alt || title}
            fill
            priority={background.priority}
            className="object-cover"
            sizes="100vw"
          />
          {overlay > 0 && (
            <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
          )}
        </>
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="container mx-auto px-4">
          <div className={`text-${textAlign} text-white`}>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xl md:text-2xl mb-8">{subtitle}</p>
            )}
            {cta && (
              <a
                href={cta.link}
                className={`inline-block px-8 py-4 rounded-lg font-semibold transition ${
                  cta.style === 'primary'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-white hover:bg-gray-100 text-gray-900'
                }`}
              >
                {cta.text}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SplitHero({ title, subtitle, cta, image, imagePosition = 'right' }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className={`grid md:grid-cols-2 gap-12 items-center ${
          imagePosition === 'left' ? 'md:flex-row-reverse' : ''
        }`}>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
            {subtitle && <p className="text-xl mb-8">{subtitle}</p>}
            {cta && (
              <a href={cta.link} className="btn-primary">
                {cta.text}
              </a>
            )}
          </div>
          <div className="relative h-[400px] md:h-[500px]">
            <Image src={image} alt={title} fill className="object-cover rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

// Export variants metadata for admin panel
export const HERO_VARIANTS = {
  fullWidth: { label: 'Full Width', icon: '🖼️' },
  split: { label: 'Split Layout', icon: '📱' },
  carousel: { label: 'Carousel', icon: '🎠' }
};
```

### Server-Side Component Wrapper

```typescript
// components/renderer/ServerBlockRenderer.tsx
import dynamic from 'next/dynamic';
import { BaseBlock } from '@/lib/types/blocks';
import { getBlockTemplate } from '@/config/blocks.config';
import { validateBlockConfig } from '@/lib/validation/blockSchemas';

// Lazy load all block components
const HeroSection = dynamic(() => import('@/components/blocks/HeroSection/HeroSection'));
const ProductSection = dynamic(() => import('@/components/blocks/ProductSection/ProductSection'));
const CategorySection = dynamic(() => import('@/components/blocks/CategorySection/CategorySection'));
const ContentSection = dynamic(() => import('@/components/blocks/ContentSection/ContentSection'));

interface Props {
  block: BaseBlock;
}

export async function ServerBlockRenderer({ block }: Props) {
  // Validate block configuration against schema
  const template = getBlockTemplate(block.type);

  if (!template) {
    console.error(`Unknown block type: ${block.type}`);
    return null;
  }

  // Merge with defaults from centralized config
  const config = {
    ...template.defaultConfig,
    ...block.config
  };

  // Validate configuration
  try {
    validateBlockConfig(block.type, config);
  } catch (error) {
    console.error(`Invalid block config for ${block.type}:`, error);
    return null;
  }

  // Render appropriate component
  const blockFamily = block.type.split('-')[0]; // 'hero', 'product', etc.

  switch (blockFamily) {
    case 'hero':
      return <HeroSection {...config} />;

    case 'product':
      return <ProductSection {...config} />;

    case 'category':
      return <CategorySection {...config} />;

    case 'content':
      return <ContentSection {...config} />;

    default:
      return null;
  }
}
```

### Benefits of This Approach

1. **Consistency**: Same component renders in admin preview AND production
2. **Type Safety**: Props validated at compile-time and runtime
3. **Centralized Defaults**: Changes in config reflect everywhere
4. **Easy Maintenance**: Update once, works everywhere
5. **Performance**: Only load needed components (dynamic imports)

---

## 🔒 Production Security & Validation

### File: `lib/validation/blockSchemas.ts` (Zod Validation)

```typescript
import { z } from 'zod';

// Reusable schemas
const CTASchema = z.object({
  text: z.string().min(1).max(50),
  link: z.string().url().or(z.string().regex(/^\//)), // URL or path
  style: z.enum(['primary', 'secondary', 'outline']).optional()
});

const ImageSchema = z.object({
  type: z.enum(['image', 'video', 'color']),
  src: z.string().optional(),
  alt: z.string().optional(),
  priority: z.boolean().optional()
});

// Hero block schemas
export const HeroFullWidthSchema = z.object({
  variant: z.literal('fullWidth'),
  title: z.string().min(1).max(100),
  subtitle: z.string().max(200).optional(),
  cta: CTASchema.optional(),
  background: ImageSchema.optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  height: z.enum(['small', 'medium', 'large', 'full']).optional(),
  overlay: z.number().min(0).max(1).optional()
});

// Product block schemas
export const ProductSliderSchema = z.object({
  variant: z.literal('slider'),
  title: z.string().min(1).max(100),
  subtitle: z.string().max(200).optional(),
  collection: z.string().min(1),
  limit: z.number().int().min(4).max(20),
  columns: z.object({
    mobile: z.number().int().min(1).max(4),
    tablet: z.number().int().min(1).max(6),
    desktop: z.number().int().min(1).max(8)
  }).optional(),
  showBadges: z.boolean().optional(),
  showQuickAdd: z.boolean().optional(),
  lazyLoad: z.boolean().optional()
});

// Master validation function
export function validateBlockConfig(blockType: string, config: any) {
  const schemaMap: Record<string, z.ZodSchema> = {
    'hero-full-width': HeroFullWidthSchema,
    'product-slider': ProductSliderSchema,
    // Add all other schemas
  };

  const schema = schemaMap[blockType];

  if (!schema) {
    throw new Error(`No validation schema for block type: ${blockType}`);
  }

  return schema.parse(config); // Throws if invalid
}
```

### File: `lib/validation/sanitizers.ts` (XSS Protection)

```typescript
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  });
}

export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove HTML brackets
    .trim();
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http, https, and relative paths
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '#';
    }
    return url;
  } catch {
    // Relative path
    if (url.startsWith('/')) {
      return url;
    }
    return '#';
  }
}
```

### File: `app/api/pages/save/route.ts` (Secure API with Rate Limiting)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { validateBlockConfig } from '@/lib/validation/blockSchemas';
import { sanitizeHtml, sanitizeText } from '@/lib/validation/sanitizers';
import { savePageToDatabase } from '@/lib/db/pages';
import { PageConfigSchema } from '@/lib/validation/pageSchema';

// Rate limiter: 10 saves per minute per IP
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip || 'unknown';
    await rateLimiter.consume(ip);

    // Authentication check
    const session = await getIronSession(request, {
      /* session config */
    });

    if (!session.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedPage = PageConfigSchema.parse(body);

    // Validate and sanitize each block
    for (const block of validatedPage.blocks) {
      // Validate against schema
      validateBlockConfig(block.type, block.config);

      // Sanitize HTML content
      if (block.config.content) {
        block.config.content = sanitizeHtml(block.config.content);
      }

      // Sanitize text fields
      if (block.config.title) {
        block.config.title = sanitizeText(block.config.title);
      }
    }

    // Save to database
    const savedPage = await savePageToDatabase({
      ...validatedPage,
      metadata: {
        ...validatedPage.metadata,
        updatedAt: new Date().toISOString(),
        author: session.user.email,
        version: (validatedPage.metadata.version || 0) + 1
      }
    });

    // Revalidate cache
    // await revalidatePath(`/${savedPage.slug}`);

    return NextResponse.json({
      success: true,
      page: savedPage
    });

  } catch (error) {
    if (error.name === 'RateLimiterError') {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    console.error('Save page error:', error);
    return NextResponse.json(
      { error: 'Failed to save page', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🔧 Implementation Steps (Updated for Production)

### Phase 1: Setup State Management (Day 1)

**File:** `lib/store/pageBuilderStore.ts`

```typescript
import { create } from 'zustand';
import { BaseBlock, PageConfig } from '@/lib/types/blocks';

interface PageBuilderState {
  blocks: BaseBlock[];
  selectedBlockId: string | null;
  previewMode: boolean;
  
  // Actions
  addBlock: (block: BaseBlock) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, config: Record<string, any>) => void;
  reorderBlocks: (blocks: BaseBlock[]) => void;
  selectBlock: (id: string | null) => void;
  togglePreview: () => void;
  loadPage: (config: PageConfig) => void;
  savePage: () => Promise<void>;
}

export const usePageBuilder = create<PageBuilderState>((set, get) => ({
  blocks: [],
  selectedBlockId: null,
  previewMode: false,
  
  addBlock: (block) => {
    set((state) => ({
      blocks: [...state.blocks, { ...block, order: state.blocks.length }]
    }));
  },
  
  removeBlock: (id) => {
    set((state) => ({
      blocks: state.blocks
        .filter(b => b.id !== id)
        .map((b, idx) => ({ ...b, order: idx }))
    }));
  },
  
  updateBlock: (id, config) => {
    set((state) => ({
      blocks: state.blocks.map(b => 
        b.id === id ? { ...b, config: { ...b.config, ...config } } : b
      )
    }));
  },
  
  reorderBlocks: (blocks) => {
    set({ blocks: blocks.map((b, idx) => ({ ...b, order: idx })) });
  },
  
  selectBlock: (id) => set({ selectedBlockId: id }),
  
  togglePreview: () => set((state) => ({ 
    previewMode: !state.previewMode,
    selectedBlockId: null 
  })),
  
  loadPage: (config) => {
    set({ blocks: config.blocks.sort((a, b) => a.order - b.order) });
  },
  
  savePage: async () => {
    const { blocks } = get();
    await fetch('/api/pages/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks })
    });
  }
}));
```

---

### Phase 2: Block Library Sidebar (Day 1-2)

**File:** `components/builder/BlockLibrary.tsx`

```typescript
import { Plus } from 'lucide-react';
import { usePageBuilder } from '@/lib/store/pageBuilderStore';
import { v4 as uuidv4 } from 'uuid';

const BLOCK_TEMPLATES = [
  {
    type: 'hero-full-width',
    label: 'Full Width Hero',
    icon: '🖼️',
    defaultConfig: {
      title: 'New Hero Section',
      subtitle: 'Add your subtitle here',
      cta: { text: 'Shop Now', link: '#' },
      background: '/placeholder.jpg'
    }
  },
  {
    type: 'hero-carousel',
    label: 'Carousel Hero',
    icon: '🎠',
    defaultConfig: {
      slides: [
        {
          title: 'Slide 1',
          subtitle: 'Description',
          cta: { text: 'Learn More', link: '#' }
        }
      ],
      autoplay: true,
      interval: 5000
    }
  },
  {
    type: 'product-slider',
    label: 'Product Slider',
    icon: '🛍️',
    defaultConfig: {
      title: 'Featured Products',
      collection: 'best-sellers',
      limit: 8
    }
  },
  // ... more templates
];

export default function BlockLibrary() {
  const addBlock = usePageBuilder(state => state.addBlock);
  
  const handleAddBlock = (template: typeof BLOCK_TEMPLATES[0]) => {
    addBlock({
      id: uuidv4(),
      type: template.type,
      order: 0,
      config: template.defaultConfig
    });
  };
  
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <h3 className="font-semibold text-sm uppercase text-gray-600 mb-4">
        Add Blocks
      </h3>
    
      <div className="space-y-2">
        {BLOCK_TEMPLATES.map((template) => (
          <button
            key={template.type}
            onClick={() => handleAddBlock(template)}
            className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-sm transition text-left"
          >
            <span className="text-2xl">{template.icon}</span>
            <span className="text-sm font-medium">{template.label}</span>
            <Plus size={16} className="ml-auto text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### Phase 3: Drag & Drop Canvas (Day 2-3)

**File:** `components/builder/Canvas.tsx`

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { usePageBuilder } from '@/lib/store/pageBuilderStore';
import BlockWrapper from './BlockWrapper';

export default function Canvas() {
  const { blocks, reorderBlocks } = usePageBuilder();
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
  
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id);
      const newIndex = blocks.findIndex(b => b.id === over.id);
    
      reorderBlocks(arrayMove(blocks, oldIndex, newIndex));
    }
  };
  
  return (
    <div className="flex-1 bg-white overflow-y-auto p-8">
      <div className="max-w-screen-xl mx-auto">
        {blocks.length === 0 ? (
          <div className="border-4 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-lg">
              Drag blocks from the left sidebar to start building
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block) => (
                <BlockWrapper key={block.id} block={block} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
```

---

### Phase 4: Block Wrapper with Controls (Day 3)

**File:** `components/builder/BlockWrapper.tsx`

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Settings, Trash2, Copy } from 'lucide-react';
import { usePageBuilder } from '@/lib/store/pageBuilderStore';
import BlockRenderer from '../renderer/BlockRenderer';

interface Props {
  block: BaseBlock;
}

export default function BlockWrapper({ block }: Props) {
  const { removeBlock, selectBlock, selectedBlockId } = usePageBuilder();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };
  
  const isSelected = selectedBlockId === block.id;
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group mb-4 rounded-lg transition ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-300'
      }`}
      onClick={() => selectBlock(block.id)}
    >
      {/* Control Bar */}
      <div className={`absolute -top-10 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gray-900 text-white rounded-t-lg transition ${
        isSelected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-700 rounded"
          >
            <GripVertical size={18} />
          </button>
          <span className="text-sm font-medium">{block.type}</span>
        </div>
      
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              selectBlock(block.id);
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Duplicate logic here
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this block?')) {
                removeBlock(block.id);
              }
            }}
            className="p-1 hover:bg-red-600 rounded"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    
      {/* Block Content */}
      <div className="pointer-events-none">
        <BlockRenderer block={block} />
      </div>
    </div>
  );
}
```

---

### Phase 5: Block Settings Sidebar (Day 4)

**File:** `components/builder/BlockSettings.tsx`

```typescript
import { usePageBuilder } from '@/lib/store/pageBuilderStore';
import { X } from 'lucide-react';

export default function BlockSettings() {
  const { blocks, selectedBlockId, updateBlock, selectBlock } = usePageBuilder();
  
  const selectedBlock = blocks.find(b => b.id === selectedBlockId);
  
  if (!selectedBlock) {
    return (
      <div className="w-80 bg-gray-50 border-l border-gray-200 p-6">
        <p className="text-gray-400 text-sm text-center">
          Select a block to edit its settings
        </p>
      </div>
    );
  }
  
  const handleUpdate = (key: string, value: any) => {
    updateBlock(selectedBlock.id, { [key]: value });
  };
  
  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 overflow-y-auto">
      <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
        <h3 className="font-semibold">Block Settings</h3>
        <button
          onClick={() => selectBlock(null)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <X size={18} />
        </button>
      </div>
    
      <div className="p-4 space-y-4">
        {/* Dynamic form based on block type */}
        {selectedBlock.type === 'hero-full-width' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={selectedBlock.config.title || ''}
                onChange={(e) => handleUpdate('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          
            <div>
              <label className="block text-sm font-medium mb-2">Subtitle</label>
              <textarea
                value={selectedBlock.config.subtitle || ''}
                onChange={(e) => handleUpdate('subtitle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>
          
            <div>
              <label className="block text-sm font-medium mb-2">CTA Text</label>
              <input
                type="text"
                value={selectedBlock.config.cta?.text || ''}
                onChange={(e) => handleUpdate('cta', { 
                  ...selectedBlock.config.cta,
                  text: e.target.value 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          
            <div>
              <label className="block text-sm font-medium mb-2">CTA Link</label>
              <input
                type="text"
                value={selectedBlock.config.cta?.link || ''}
                onChange={(e) => handleUpdate('cta', { 
                  ...selectedBlock.config.cta,
                  link: e.target.value 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          
            <div>
              <label className="block text-sm font-medium mb-2">Background Image</label>
              <input
                type="text"
                value={selectedBlock.config.background || ''}
                onChange={(e) => handleUpdate('background', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="/images/hero.jpg"
              />
            </div>
          </>
        )}
      
        {selectedBlock.type === 'product-slider' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Section Title</label>
              <input
                type="text"
                value={selectedBlock.config.title || ''}
                onChange={(e) => handleUpdate('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          
            <div>
              <label className="block text-sm font-medium mb-2">Collection</label>
              <select
                value={selectedBlock.config.collection || ''}
                onChange={(e) => handleUpdate('collection', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="best-sellers">Best Sellers</option>
                <option value="new-arrivals">New Arrivals</option>
                <option value="sale">On Sale</option>
                <option value="featured">Featured</option>
              </select>
            </div>
          
            <div>
              <label className="block text-sm font-medium mb-2">Number of Products</label>
              <input
                type="number"
                value={selectedBlock.config.limit || 8}
                onChange={(e) => handleUpdate('limit', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="4"
                max="20"
              />
            </div>
          </>
        )}
      
        {/* Add more block type configurations here */}
      </div>
    </div>
  );
}
```

---

### Phase 6: Block Renderer (Day 4-5)

**File:** `components/renderer/BlockRenderer.tsx`

```typescript
import dynamic from 'next/dynamic';
import { BaseBlock } from '@/lib/types/blocks';

// Dynamically import all block components
const HeroFullWidth = dynamic(() => import('@/components/blocks/HeroFullWidth'));
const HeroCarousel = dynamic(() => import('@/components/blocks/HeroCarousel'));
const ProductSlider = dynamic(() => import('@/components/blocks/ProductSlider'));
// ... import others

interface Props {
  block: BaseBlock;
}

export default function BlockRenderer({ block }: Props) {
  switch (block.type) {
    case 'hero-full-width':
      return <HeroFullWidth config={block.config} />;
    
    case 'hero-carousel':
      return <HeroCarousel config={block.config} />;
    
    case 'product-slider':
      return <ProductSlider config={block.config} />;
    
    case 'category-preview':
      return <CategoryPreview config={block.config} />;
    
    case 'blog-section':
      return <BlogSection config={block.config} />;
    
    case 'testimonials':
      return <Testimonials config={block.config} />;
    
    default:
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">Unknown block type: {block.type}</p>
        </div>
      );
  }
}
```

---

### Phase 7: Main Builder Page (Day 5)

**File:** `app/admin/page-builder/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Eye, Save, Undo, Redo } from 'lucide-react';
import BlockLibrary from '@/components/builder/BlockLibrary';
import Canvas from '@/components/builder/Canvas';
import BlockSettings from '@/components/builder/BlockSettings';
import { usePageBuilder } from '@/lib/store/pageBuilderStore';

export default function PageBuilder() {
  const { previewMode, togglePreview, savePage, loadPage } = usePageBuilder();
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    // Load existing page config on mount
    fetch('/api/pages/home')
      .then(res => res.json())
      .then(config => loadPage(config));
  }, []);
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePage();
      alert('Page saved successfully!');
    } catch (error) {
      alert('Failed to save page');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (previewMode) {
    return (
      <div className="h-screen flex flex-col">
        <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
          <h1 className="font-semibold">Preview Mode</h1>
          <button
            onClick={togglePreview}
            className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium"
          >
            Exit Preview
          </button>
        </div>
        <iframe
          src="/preview"
          className="flex-1 w-full border-0"
        />
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Page Builder</h1>
      
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-gray-700 rounded">
            <Undo size={18} />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded">
            <Redo size={18} />
          </button>
        
          <div className="w-px h-6 bg-gray-700" />
        
          <button
            onClick={togglePreview}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            <Eye size={18} />
            Preview
          </button>
        
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        <BlockLibrary />
        <Canvas />
        <BlockSettings />
      </div>
    </div>
  );
}
```

---

### Phase 8: Public Page Renderer (Day 5)

**File:** `app/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import BlockRenderer from '@/components/renderer/BlockRenderer';

async function getPageConfig() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pages/home`, {
    cache: 'no-store' // or use ISR with revalidate
  });
  
  if (!res.ok) return null;
  return res.json();
}

export default async function HomePage() {
  const pageConfig = await getPageConfig();
  
  if (!pageConfig) {
    notFound();
  }
  
  return (
    <main>
      {pageConfig.blocks
        .sort((a, b) => a.order - b.order)
        .map((block) => (
          <BlockRenderer key={block.id} block={block} />
        ))}
    </main>
  );
}
```

---

### Phase 9: API Endpoints (Day 6)

**File:** `app/api/pages/save/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { savePageToDatabase } from '@/lib/db/pages';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await request.json();
  
  const pageConfig = {
    id: 'home-page',
    title: 'Home Page',
    status: 'draft',
    blocks: body.blocks,
    metadata: {
      updatedAt: new Date().toISOString(),
      author: session.user.email
    }
  };
  
  await savePageToDatabase(pageConfig);
  
  return NextResponse.json({ success: true });
}
```

**File:** `app/api/pages/[slug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPageFromDatabase } from '@/lib/db/pages';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const pageConfig = await getPageFromDatabase(params.slug);
  
  if (!pageConfig) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  
  return NextResponse.json(pageConfig);
}
```

---

## 🎨 Preview Mode Implementation

### Option 1: Iframe Preview (Recommended)

```typescript
// app/preview/page.tsx
'use client';

import { useEffect, useState } from 'react';
import BlockRenderer from '@/components/renderer/BlockRenderer';

export default function PreviewPage() {
  const [blocks, setBlocks] = useState([]);
  
  useEffect(() => {
    // Listen for messages from parent window
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'UPDATE_PREVIEW') {
        setBlocks(event.data.blocks);
      }
    };
  
    window.addEventListener('message', handleMessage);
  
    // Request initial data
    window.parent.postMessage({ type: 'REQUEST_BLOCKS' }, '*');
  
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  return (
    <main>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </main>
  );
}
```

### Option 2: Modal Preview

```typescript
// components/builder/PreviewModal.tsx
export default function PreviewModal({ onClose }) {
  const blocks = usePageBuilder(state => state.blocks);
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Preview</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 📱 Responsive Preview (Day 6-7)

```typescript
// components/builder/DevicePreview.tsx
import { useState } from 'react';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

const DEVICES = {
  desktop: { width: '100%', icon: Monitor },
  tablet: { width: '768px', icon: Tablet },
  mobile: { width: '375px', icon: Smartphone }
};

export default function DevicePreview() {
  const [device, setDevice] = useState('desktop');
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b">
        {Object.entries(DEVICES).map(([key, { icon: Icon }]) => (
          <button
            key={key}
            onClick={() => setDevice(key)}
            className={`p-2 rounded ${
              device === key ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>
    
      <div className="flex-1 flex items-center justify-center bg-gray-100 p-8">
        <div
          style={{ width: DEVICES[device].width, maxWidth: '100%' }}
          className="bg-white shadow-xl rounded-lg overflow-hidden"
        >
          <iframe src="/preview" className="w-full h-[800px] border-0" />
        </div>
      </div>
    </div>
  );
}
```

---

## 🔐 Security Considerations

### Input Validation

```typescript
// lib/validation/blockSchema.ts
import { z } from 'zod';

const HeroConfigSchema = z.object({
  title: z.string().max(100),
  subtitle: z.string().max(200),
  cta: z.object({
    text: z.string().max(50),
    link: z.string().url()
  })
});

const ProductSliderConfigSchema = z.object({
  title: z.string().max(100),
  collection: z.enum(['best-sellers', 'new-arrivals', 'sale', 'featured']),
  limit: z.number().min(4).max(20)
});

export const validateBlockConfig = (type: string, config: any) => {
  switch (type) {
    case 'hero-full-width':
      return HeroConfigSchema.parse(config);
    case 'product-slider':
      return ProductSliderConfigSchema.parse(config);
    // Add more validators
  }
};
```

### Permission Check

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const session = await getServerSession();
  
    if (!session || session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return NextResponse.next();
}
```

---

## 🚀 Performance Optimization

### 1. Code Splitting

```typescript
// Dynamic imports for block components
const BlockComponent = dynamic(
  () => import(`@/components/blocks/${blockType}`),
  { loading: () => <BlockSkeleton /> }
);
```

### 2. Image Optimization

```typescript
import Image from 'next/image';

// In block components
<Image
  src={config.background}
  alt={config.title}
  width={1920}
  height={1080}
  priority={block.order === 0}
  className="object-cover"
/>
```

### 3. Debounced Auto-save

```typescript
import { useDebounce } from '@/hooks/useDebounce';

const debouncedSave = useDebounce(() => {
  savePage();
}, 2000);

// Call on every update
useEffect(() => {
  debouncedSave();
}, [blocks]);
```

---

## 📦 Database Schema (MongoDB)

### Collection: `pages`

```typescript
// MongoDB Schema Definition using Mongoose
import mongoose from 'mongoose';

const PageSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 255
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  seo: {
    title: String,
    description: String,
    keywords: [String],
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    twitterTitle: String,
    twitterDescription: String,
    canonicalUrl: String,
    noIndex: { type: Boolean, default: false },
    noFollow: { type: Boolean, default: false }
  },
  blocks: [{
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, required: true },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    metadata: {
      templateId: String,
      templateVersion: String,
      createdAt: Date,
      updatedAt: Date
    }
  }],
  settings: {
    cache: {
      enabled: { type: Boolean, default: true },
      ttl: { type: Number, default: 300 },
      strategy: {
        type: String,
        enum: ['cache-first', 'network-first', 'stale-while-revalidate'],
        default: 'stale-while-revalidate'
      }
    },
    analytics: {
      trackPageView: { type: Boolean, default: true },
      trackBlockViews: { type: Boolean, default: false }
    }
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    publishedAt: Date,
    author: { type: String, required: true },
    version: { type: Number, default: 1 },
    changeFrequency: {
      type: String,
      enum: ['always', 'hourly', 'daily', 'weekly', 'monthly']
    }
  }
}, {
  timestamps: true,
  collection: 'pages'
});

// Indexes for performance
PageSchema.index({ slug: 1, status: 1 });
PageSchema.index({ 'metadata.updatedAt': -1 });
PageSchema.index({ 'blocks.type': 1 }); // Query pages by block type

export const Page = mongoose.model('Page', PageSchema);
```

### Collection: `page_versions` (Version History)

```typescript
const PageVersionSchema = new mongoose.Schema({
  pageId: {
    type: String,
    required: true,
    index: true,
    ref: 'Page'
  },
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  changeDescription: String,
  version: {
    type: Number,
    required: true
  }
}, {
  collection: 'page_versions'
});

// Compound index for efficient version queries
PageVersionSchema.index({ pageId: 1, version: -1 });

export const PageVersion = mongoose.model('PageVersion', PageVersionSchema);
```

### MongoDB Database Operations

```typescript
// lib/db/pages.ts
import { Page, PageVersion } from '@/models/Page';
import { PageConfig } from '@/lib/types/blocks';

/**
 * Get page configuration by slug
 */
export async function getPageConfig(slug: string): Promise<PageConfig | null> {
  try {
    const page = await Page.findOne({
      slug,
      status: 'published'
    }).lean();

    return page;
  } catch (error) {
    console.error('Error fetching page:', error);
    return null;
  }
}

/**
 * Get all published pages (for sitemap generation)
 */
export async function getAllPublishedPages() {
  try {
    return await Page.find({ status: 'published' })
      .select('slug title metadata.updatedAt metadata.changeFrequency')
      .sort({ 'metadata.updatedAt': -1 })
      .lean();
  } catch (error) {
    console.error('Error fetching published pages:', error);
    return [];
  }
}

/**
 * Save page to database with version history
 */
export async function savePageToDatabase(pageConfig: PageConfig) {
  try {
    // Update timestamps
    pageConfig.metadata.updatedAt = new Date().toISOString();

    // Save current version to history
    const currentPage = await Page.findOne({ _id: pageConfig.id });
    if (currentPage) {
      await PageVersion.create({
        pageId: pageConfig.id,
        snapshot: currentPage.toObject(),
        createdBy: pageConfig.metadata.author,
        version: currentPage.metadata.version
      });
    }

    // Increment version
    pageConfig.metadata.version = (currentPage?.metadata.version || 0) + 1;

    // Upsert page
    const savedPage = await Page.findOneAndUpdate(
      { _id: pageConfig.id },
      pageConfig,
      { upsert: true, new: true, runValidators: true }
    );

    return savedPage;
  } catch (error) {
    console.error('Error saving page:', error);
    throw new Error('Failed to save page to database');
  }
}

/**
 * Get page version history
 */
export async function getPageVersionHistory(pageId: string, limit = 10) {
  try {
    return await PageVersion.find({ pageId })
      .sort({ version: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('Error fetching version history:', error);
    return [];
  }
}

/**
 * Restore page to specific version
 */
export async function restorePageVersion(pageId: string, version: number) {
  try {
    const versionSnapshot = await PageVersion.findOne({ pageId, version });

    if (!versionSnapshot) {
      throw new Error('Version not found');
    }

    const restoredPage = await Page.findOneAndUpdate(
      { _id: pageId },
      {
        ...versionSnapshot.snapshot,
        'metadata.updatedAt': new Date()
      },
      { new: true }
    );

    return restoredPage;
  } catch (error) {
    console.error('Error restoring version:', error);
    throw error;
  }
}
```

### MongoDB Connection Setup

```typescript
// lib/db/mongodb.ts
import mongoose from 'mongoose';

// Environment variables
const MONGODB_URI = process.env.VINC_MONGO_URL;
const MONGODB_DB = process.env.VINC_MONGO_DB;
const MIN_POOL_SIZE = parseInt(process.env.VINC_MONGO_MIN_POOL_SIZE || '0');
const MAX_POOL_SIZE = parseInt(process.env.VINC_MONGO_MAX_POOL_SIZE || '100');

if (!MONGODB_URI) {
  throw new Error('Please define VINC_MONGO_URL environment variable');
}

if (!MONGODB_DB) {
  throw new Error('Please define VINC_MONGO_DB environment variable');
}

/**
 * Global MongoDB connection cache for Next.js
 * Prevents multiple connections in development with hot reloading
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      dbName: MONGODB_DB,
      bufferCommands: false,
      minPoolSize: MIN_POOL_SIZE,
      maxPoolSize: MAX_POOL_SIZE,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('❌ MongoDB connection error:', e);
    throw e;
  }

  return cached.conn;
}

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  });
}
```

### Environment Variables (.env.local)

```bash
# MongoDB Configuration
VINC_MONGO_URL=mongodb://admin:admin@localhost:27017/?authSource=admin
VINC_MONGO_DB=app
VINC_MONGO_MIN_POOL_SIZE=0
VINC_MONGO_MAX_POOL_SIZE=100

# For production, use MongoDB Atlas or similar:
# VINC_MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
# VINC_MONGO_DB=vinc_production

# Session Secret (for iron-session)
SESSION_SECRET=your-super-secret-key-at-least-32-characters-long

# API Rate Limiting
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000

# Next.js
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Why MongoDB for This CMS?

MongoDB is the ideal choice for this page builder CMS because:

1. **Flexible Schema**: Block configurations can vary widely - MongoDB handles nested JSON naturally
2. **No Schema Migrations**: Add new block types without altering database structure
3. **Embedded Documents**: Store entire page configuration as a single document
4. **Fast Queries**: Index on slug and status for instant page retrieval
5. **Version History**: Store complete page snapshots without complex joins
6. **Horizontal Scaling**: Easy to scale as your B2C traffic grows

### Example: Using MongoDB in API Routes

```typescript
// app/api/pages/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Page } from '@/models/Page';

// GET page by slug (SSR calls this)
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await connectToDatabase();

    const page = await Page.findOne({
      slug: params.slug,
      status: 'published'
    })
      .select('-__v') // Exclude version field
      .lean(); // Return plain JS object for better performance

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Set cache headers for CDN
    return NextResponse.json(page, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });

  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### MongoDB Query Performance Tips

```typescript
// lib/db/pages.ts - Optimized queries

/**
 * Get page with only necessary fields (faster)
 */
export async function getPageForSSR(slug: string) {
  return await Page.findOne({ slug, status: 'published' })
    .select('title slug seo blocks settings') // Only needed fields
    .lean() // Plain object, no Mongoose overhead
    .exec();
}

/**
 * Bulk operations for sitemap generation
 */
export async function getAllPageSlugs() {
  return await Page.find({ status: 'published' })
    .select('slug metadata.updatedAt') // Minimal fields
    .sort({ 'metadata.updatedAt': -1 })
    .lean()
    .exec();
}

/**
 * Aggregation for analytics
 */
export async function getBlockUsageStats() {
  return await Page.aggregate([
    { $match: { status: 'published' } },
    { $unwind: '$blocks' },
    {
      $group: {
        _id: '$blocks.type',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// __tests__/pageBuilder.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePageBuilder } from '@/lib/store/pageBuilderStore';

describe('Page Builder Store', () => {
  it('should add a block', () => {
    const { result } = renderHook(() => usePageBuilder());
  
    act(() => {
      result.current.addBlock({
        id: 'test-1',
        type: 'hero-full-width',
        order: 0,
        config: {}
      });
    });
  
    expect(result.current.blocks).toHaveLength(1);
  });
  
  it('should reorder blocks', () => {
    // Test drag and drop logic
  });
});
```

---

## 📋 Production Implementation Timeline

| Phase | Task                                    | Duration | Priority  | SEO Impact |
| ----- | --------------------------------------- | -------- | --------- | ---------- |
| 1     | **Centralized config setup**            | 2 days   | Critical  | High       |
|       | - Create config/blocks.config.ts        |          |           |            |
|       | - Create config/theme.config.ts         |          |           |            |
|       | - Create config/seo.config.ts           |          |           |            |
| 2     | **TypeScript & validation schemas**     | 1 day    | Critical  | Medium     |
|       | - Define all type interfaces            |          |           |            |
|       | - Create Zod validation schemas         |          |           |            |
|       | - Setup sanitizers (XSS protection)     |          |           |            |
| 3     | **Reusable block components**           | 3 days   | High      | High       |
|       | - HeroSection with variants             |          |           |            |
|       | - ProductSection with variants          |          |           |            |
|       | - CategorySection with variants         |          |           |            |
|       | - ContentSection with variants          |          |           |            |
| 4     | **SSR pages with SEO**                  | 2 days   | Critical  | Critical   |
|       | - app/(public)/page.tsx with metadata   |          |           |            |
|       | - ServerBlockRenderer component         |          |           |            |
|       | - Dynamic metadata generation           |          |           |            |
|       | - Structured data (JSON-LD)             |          |           |            |
|       | - Sitemap.xml & robots.txt generation   |          |           |            |
| 5     | **Admin builder interface**             | 4 days   | High      | None       |
|       | - State management (Zustand)            |          |           |            |
|       | - Block library sidebar                 |          |           |            |
|       | - Drag & drop canvas                    |          |           |            |
|       | - Block wrapper with controls           |          |           |            |
|       | - Settings sidebar                      |          |           |            |
| 6     | **Secure API endpoints**                | 2 days   | Critical  | None       |
|       | - Authentication & authorization        |          |           |            |
|       | - Rate limiting                         |          |           |            |
|       | - Input validation & sanitization       |          |           |            |
|       | - Error handling                        |          |           |            |
| 7     | **Database & caching**                  | 2 days   | High      | High       |
|       | - MongoDB schema setup (Mongoose)       |          |           |            |
|       | - Database operations (CRUD)            |          |           |            |
|       | - Connection pooling configuration      |          |           |            |
|       | - ISR configuration                     |          |           |            |
| 8     | **Image optimization**                  | 1 day    | High      | High       |
|       | - Next.js Image component integration   |          |           |            |
|       | - Sharp configuration                   |          |           |            |
|       | - Lazy loading implementation           |          |           |            |
| 9     | **Performance optimization**            | 2 days   | High      | High       |
|       | - Code splitting                        |          |           |            |
|       | - Bundle size analysis                  |          |           |            |
|       | - Core Web Vitals optimization          |          |           |            |
| 10    | **Testing**                             | 3 days   | High      | Medium     |
|       | - Unit tests (components, utils)        |          |           |            |
|       | - Integration tests (API routes)        |          |           |            |
|       | - E2E tests (page builder workflow)     |          |           |            |
|       | - SEO validation tests                  |          |           |            |
| 11    | **Production deployment**               | 2 days   | Critical  | Critical   |
|       | - Environment configuration             |          |           |            |
|       | - Database migration                    |          |           |            |
|       | - Monitoring & logging setup            |          |           |            |
|       | - Security audit                        |          |           |            |

**Total: ~24-26 days for production-ready implementation**

---

## 🎯 Production Deployment Checklist

### Phase 1: Configuration & Setup
* [ ] Install all production dependencies (zod, sharp, iron-session, rate-limiter-flexible, dompurify)
* [ ] Create centralized config files:
  * [ ] config/blocks.config.ts (all block templates)
  * [ ] config/theme.config.ts (design tokens)
  * [ ] config/seo.config.ts (SEO defaults)
* [ ] Setup TypeScript interfaces for all types
* [ ] Create Zod validation schemas for all blocks
* [ ] Implement XSS sanitization functions

### Phase 2: Reusable Components (SSR-Compatible)
* [ ] Build HeroSection component with all variants
* [ ] Build ProductSection component with all variants
* [ ] Build CategorySection component with all variants
* [ ] Build ContentSection component with all variants
* [ ] Create ServerBlockRenderer wrapper
* [ ] Test all components render server-side

### Phase 3: SEO Implementation
* [ ] Implement generateMetadata() for all public pages
* [ ] Create metadata generator utility
* [ ] Implement structured data (JSON-LD) generation
* [ ] Create dynamic sitemap.xml
* [ ] Create robots.txt
* [ ] Add Open Graph image generation (@vercel/og)
* [ ] Test with Google Rich Results Test
* [ ] Test with Facebook Sharing Debugger

### Phase 4: Admin Builder
* [ ] Setup Zustand store for page builder state
* [ ] Build block library sidebar using centralized config
* [ ] Implement drag-and-drop canvas with @dnd-kit
* [ ] Create block wrapper with edit controls
* [ ] Build dynamic settings sidebar
* [ ] Add real-time preview functionality
* [ ] Implement auto-save with debouncing

### Phase 5: Security & APIs
* [ ] Implement authentication (NextAuth or iron-session)
* [ ] Add rate limiting to all API routes
* [ ] Validate all inputs with Zod schemas
* [ ] Sanitize all user-generated content
* [ ] Add CSRF protection
* [ ] Implement proper error handling
* [ ] Add audit logging for admin actions

### Phase 6: Database & Performance
* [ ] Setup MongoDB database connection
* [ ] Create Mongoose schemas (pages, page_versions)
* [ ] Configure connection pooling (min/max pool size)
* [ ] Implement database operations (CRUD)
* [ ] Test MongoDB indexes for query performance
* [ ] Configure ISR revalidation times
* [ ] Setup CDN for static assets
* [ ] Optimize images with Next.js Image
* [ ] Implement lazy loading for below-fold content
* [ ] Bundle size optimization (<100KB initial load)

### Phase 7: Testing
* [ ] Write unit tests for all utilities
* [ ] Write component tests for blocks
* [ ] Write API integration tests
* [ ] Run E2E tests for page builder workflow
* [ ] Test SEO metadata rendering
* [ ] Run Lighthouse audits (target: 90+ all metrics)
* [ ] Test on real devices (mobile, tablet, desktop)
* [ ] Security audit with OWASP checklist

### Phase 8: Production Launch
* [ ] Setup environment variables
* [ ] Configure production database
* [ ] Setup monitoring (Sentry, LogRocket, etc.)
* [ ] Configure error tracking
* [ ] Setup uptime monitoring
* [ ] Create backup strategy
* [ ] Document API endpoints
* [ ] Create admin user guide
* [ ] Setup CI/CD pipeline
* [ ] Deploy to staging environment
* [ ] Run final QA on staging
* [ ] Deploy to production
* [ ] Submit sitemap to Google Search Console
* [ ] Monitor Core Web Vitals in Search Console

---

## 🔗 Useful Resources

### Core Technologies
* [@dnd-kit Documentation](https://docs.dndkit.com/) - Drag and drop toolkit
* [Zustand Guide](https://zustand-demo.pmnd.rs/) - State management
* [Next.js App Router](https://nextjs.org/docs/app) - React framework
* [Tailwind CSS](https://tailwindcss.com/docs) - Styling framework

### SEO & Performance
* [Next.js SEO](https://nextjs.org/docs/app/building-your-application/optimizing/metadata) - Metadata API
* [Schema.org](https://schema.org/) - Structured data reference
* [Google Rich Results Test](https://search.google.com/test/rich-results) - Test structured data
* [Core Web Vitals](https://web.dev/vitals/) - Performance metrics
* [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) - Automated audits

### Security & Validation
* [Zod Documentation](https://zod.dev/) - TypeScript schema validation
* [DOMPurify](https://github.com/cure53/DOMPurify) - XSS sanitization
* [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Security best practices
* [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) - Rate limiting

### Deployment & Monitoring
* [Vercel Deployment](https://vercel.com/docs) - Hosting platform
* [Sentry](https://docs.sentry.io/) - Error tracking
* [Google Search Console](https://search.google.com/search-console) - SEO monitoring

---

## 💡 Future Enhancements

### Phase 1 Extensions
* A/B testing for different page versions
* Analytics integration per block (GA4, Mixpanel)
* Heatmap tracking for block engagement
* Conversion funnel visualization

### Phase 2 Extensions
* Template marketplace with pre-built pages
* Multi-language support (i18n) per block
* Dynamic personalization based on user segments
* Advanced animations & interactions per block

### Phase 3 Extensions
* Real-time collaboration (multiple editors)
* Mobile app for quick content updates
* AI-powered content suggestions
* Automated accessibility testing
* Content scheduling & publishing workflows
* Block version control with rollback

---

## 📝 Summary: Key Differences from Original Plan

### What Changed for Production?

1. **Centralized Configuration System** (NEW)
   - All block templates in `config/blocks.config.ts`
   - Theme tokens in `config/theme.config.ts`
   - SEO defaults in `config/seo.config.ts`
   - Single source of truth for all configurations

2. **SEO-First Architecture** (NEW)
   - Full server-side rendering for all public pages
   - Dynamic metadata generation
   - Schema.org structured data (JSON-LD)
   - Automatic sitemap.xml and robots.txt
   - Open Graph image generation

3. **Template-Based Components** (NEW)
   - Reusable base components with variant props
   - Same component works in admin AND production
   - Centralized defaults merged at render time
   - SSR-compatible design

4. **Production Security** (NEW)
   - Zod validation for all API inputs
   - XSS protection with DOMPurify
   - Rate limiting on all endpoints
   - Authentication & authorization
   - CSRF protection

5. **Performance Optimization** (NEW)
   - Image optimization with Sharp
   - Lazy loading for below-fold content
   - Code splitting & dynamic imports
   - ISR caching with configurable TTL
   - Bundle size optimization

### Implementation Time
- **Original Plan**: 15-18 days
- **Production Plan**: 24-26 days
- **Added Time**: Mostly for SEO, security, testing, and centralized config

### The Result
A **production-ready, SEO-optimized, B2C e-commerce CMS** with:
- Backend rendering for maximum SEO performance
- Centralized parameter management
- Reusable, consistent components
- Enterprise-grade security
- Performance-optimized delivery
- MongoDB for flexible, scalable data storage

### Database Choice: MongoDB
Using **MongoDB with Mongoose** because:
- Perfect for flexible JSON block configurations
- No migrations needed when adding new block types
- Fast queries with proper indexing
- Built-in version history through document snapshots
- Scales horizontally for high B2C traffic
- Native JSON storage matches our data structure
