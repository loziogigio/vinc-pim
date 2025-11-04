import {
  HeroBlockConfig,
  ProductBlockConfig,
  CategoryBlockConfig,
  ContentBlockConfig,
  ProductDataTableBlockConfig,
  BlockRegistry
} from "@/lib/types/blocks";

const heroFullWidthDefault: HeroBlockConfig = {
  variant: "fullWidth",
  title: "Welcome to Our Store",
  subtitle: "Discover amazing plumbing and bathroom products.",
  cta: {
    text: "Shop Catalog",
    link: "/catalog",
    style: "primary"
  },
  background: {
    type: "image",
    src: "https://images.unsplash.com/photo-1676210134188-4c05dd172f89?auto=format&fit=crop&w=1600&q=80",
    alt: "Technician installing piping"
  },
  textAlign: "center",
  height: "large",
  overlay: 0.35
};

const heroSplitDefault: HeroBlockConfig = {
  variant: "split",
  title: "Configure Luxury Bathrooms",
  subtitle: "Curated vanities, fittings, and showers shipped direct.",
  cta: {
    text: "Explore Projects",
    link: "/projects",
    style: "secondary"
  },
  image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80",
  imagePosition: "right",
  backgroundColor: "#f8f9fa"
};

const heroCarouselDefault: HeroBlockConfig = {
  variant: "carousel",
  slides: [
    {
      title: "Replacement Boiler Kits",
      subtitle: "Available for next-day delivery in major cities.",
      cta: { text: "View Kits", link: "/collections/boilers", style: "primary" },
      image: "https://images.unsplash.com/photo-1588619461335-b81119fee1b5?auto=format&fit=crop&w=1600&q=80"
    },
    {
      title: "Designer Tapware",
      subtitle: "Premium finishes with trade-only pricing.",
      cta: { text: "Browse Tapware", link: "/collections/tapware", style: "secondary" },
      image: "https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=1600&q=80"
    }
  ],
  autoplay: true,
  interval: 5000,
  showDots: true,
  showArrows: true
};

const productSliderDefault: ProductBlockConfig = {
  variant: "slider",
  title: "Featured Trade Bundles",
  subtitle: "Ready-to-install bundles curated by our resident engineers.",
  collection: "featured",
  limit: 8,
  columns: { mobile: 1, tablet: 2, desktop: 4 },
  showBadges: true,
  showQuickAdd: true,
  slidesPerView: 4,
  spaceBetween: 24
};

const productGridDefault: ProductBlockConfig = {
  variant: "grid",
  title: "All Plumbing Essentials",
  collection: "all",
  limit: 12,
  columns: { mobile: 2, tablet: 3, desktop: 4 },
  showFilters: true,
  showSort: true,
  pagination: "infinite-scroll"
};

const categoryGridDefault: CategoryBlockConfig = {
  variant: "grid",
  title: "Shop by System",
  categories: [],
  layout: "grid",
  columns: { mobile: 2, tablet: 3, desktop: 4 },
  showImage: true,
  showCount: true,
  imageAspectRatio: "1:1"
};

const categoryCarouselDefault: CategoryBlockConfig = {
  variant: "carousel",
  title: "Browse Categories",
  categories: [],
  slidesPerView: 5,
  showImage: true
};

const contentRichTextDefault: ContentBlockConfig = {
  variant: "richText",
  content:
    "<p class='leading-relaxed'>Add engaging content, FAQs, or installation tips to support your trade customers.</p>",
  width: "contained",
  textAlign: "left",
  padding: "medium"
};

const contentFeaturesDefault: ContentBlockConfig = {
  variant: "features",
  title: "Why Installers Choose VINC",
  features: [
    {
      icon: "🚚",
      title: "Same-Day Dispatch",
      description: "Ship direct from EU distribution hubs."
    },
    {
      icon: "🛠️",
      title: "Technical Support",
      description: "Product specialists ready to advise on every order."
    },
    {
      icon: "📦",
      title: "Bundled Pricing",
      description: "Quote faster with preconfigured kits and volume pricing."
    }
  ],
  columns: { mobile: 1, tablet: 2, desktop: 3 }
};

const contentTestimonialsDefault: ContentBlockConfig = {
  variant: "testimonials",
  title: "Trusted by Installers Across Europe",
  testimonials: [
    {
      quote: "VINC keeps our teams supplied with premium fixtures without the hassle.",
      author: "Gianni R.",
      role: "Owner, Milano Plumbing Co.",
      rating: 5
    },
    {
      quote: "The private storefront lets us price confidently for each customer.",
      author: "Sofia L.",
      role: "Project Manager, AquaBuild",
      rating: 5
    }
  ],
  layout: "carousel",
  showRating: true,
  showAvatar: false
};

const contentCustomHtmlDefault: ContentBlockConfig = {
  variant: "customHtml",
  html: "<section>\n  <!-- Custom HTML block -->\n</section>"
};

const productDataTableDefault: ProductDataTableBlockConfig = {
  variant: "productDataTable",
  title: "Documenti e Specifiche",
  description:
    "Mostra documenti lato sinistro e la descrizione/azioni sulla destra. Ogni riga può avere un'icona immagine e un link.",
  labelColumnWidth: 220,
  appearance: {
    bordered: true,
    rounded: true,
    zebraStripes: false
  },
  rows: [
    {
      id: "doc-example",
      label: "Scheda Tecnica PDF",
      leftValueType: "image",
      valueType: "image",
      valueImageUrl: "https://cdn.example.com/images/demo-product.png",
      valueImageAlt: "Anteprima prodotto",
      leftHelperText: "Documento ufficiale",
      helperText: "Aggiornato 10/2024",
      link: {
        url: "https://cdn.example.com/docs/manual.pdf",
        openInNewTab: true
      },
      imageUrl: "https://cdn.example.com/icons/pdf.png",
      imageAlt: "PDF",
      imageAspectRatio: "1/1"
    }
  ]
};

// Home page carousel blocks - Refined configurations

/**
 * Hero With Widgets Configuration
 * 80/20 layout: Carousel on left (80%), Widgets on right (20%)
 * Widgets: Clock widget (top) + Calendar widget (bottom)
 */
const heroWithWidgetsConfig = {
  // Carousel slides (same as hero carousel)
  slides: [], // {id, imageDesktop, imageMobile, link?, title?, overlay?}

  breakpointMode: "simplified" as const,

  // Carousel settings
  autoplay: true,
  autoplaySpeed: 5000,
  loop: true,
  showDots: true,
  showArrows: true,

  // Widget settings
  widgets: {
    clock: {
      enabled: true,
      timezone: "Europe/Rome",
      showWeather: true,
      weatherLocation: "Paris" // City name for weather
    },
    calendar: {
      enabled: true,
      highlightToday: true,
      showWeekNumbers: false
    }
  },

  // Layout settings
  layout: {
    carouselWidth: "80%", // Left side
    widgetsWidth: "20%"   // Right side
  },

  className: "hero-with-widgets-section"
};

/**
 * Hero Carousel Configuration
 * Main hero section with multiple slides (desktop + mobile images)
 * Recommended dimensions: Desktop 1920x600px, Mobile 768x800px
 */
const heroCarouselConfig = {
  title: "",
  slides: [], // {id, imageDesktop, imageMobile, link?, title?, overlay?}
  breakpointMode: "simplified" as const, // 'simplified' | 'advanced'
  // Simplified mode: Simple item count per device
  itemsToShow: {
    desktop: 2,   // >= 1024px
    tablet: 2,    // >= 768px
    mobile: 1     // < 768px
  },
  // Advanced mode: Full Swiper.js breakpoint JSON
  breakpointsJSON: {
    "1536": { slidesPerView: 2, spaceBetween: 20 },
    "1280": { slidesPerView: 2, spaceBetween: 16 },
    "1024": { slidesPerView: 2, spaceBetween: 16 },
    "768": { slidesPerView: 2, spaceBetween: 16 },
    "520": { slidesPerView: 2, spaceBetween: 12 },
    "0": { slidesPerView: 1, spaceBetween: 5 }
  },
  cardStyle: {
    borderWidth: 0,
    borderColor: "#EAEEF2",
    borderStyle: "solid" as const,
    borderRadius: "md" as const,
    shadowSize: "none" as const,
    shadowColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#ffffff",
    hoverEffect: "none" as const,
    hoverScale: 1.02,
    hoverShadowSize: "lg" as const,
    hoverBackgroundColor: ""
  },
  autoplay: true,
  autoplaySpeed: 5000, // milliseconds
  loop: true,
  showDots: true,
  showArrows: true,
  className: "mb-12 xl:mb-14 pt-1"
};

const productGalleryConfig = {
  title: "Product Gallery",
  items: [],
  searchQuery: "",
  limit: 12,
  breakpointMode: "simplified" as const,
  columns: {
    desktop: 4,
    tablet: 2,
    mobile: 1
  },
  gap: 16,
  showPrice: true,
  showBadge: true,
  showAddToCart: false,
  className: "mb-12 xl:mb-14 pt-1"
};


/**
 * Promo Carousel Configuration
 * Promotional banners with images/videos
 */
const promoCarouselConfig = {
  items: [], // {id, mediaType: 'image'|'video', imageDesktop?, imageMobile?, videoUrl?, link?, title?}
  variant: "promo" as const,
  breakpointMode: "simplified" as const, // 'simplified' | 'advanced'
  itemsToShow: {
    desktop: 5.5,
    tablet: 4.5,
    mobile: 2.5
  },
  breakpointsJSON: {
    "1536": { slidesPerView: 5.5, spaceBetween: 20 },
    "768": { slidesPerView: 4.5, spaceBetween: 16 },
    "520": { slidesPerView: 3.5, spaceBetween: 12 },
    "0": { slidesPerView: 2.5, spaceBetween: 5 }
  },
  cardStyle: {
    borderWidth: 0,
    borderColor: "#EAEEF2",
    borderStyle: "solid" as const,
    borderRadius: "md" as const,
    shadowSize: "none" as const,
    shadowColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#ffffff",
    hoverEffect: "none" as const,
    hoverScale: 1.02,
    hoverShadowSize: "lg" as const,
    hoverBackgroundColor: ""
  },
  autoplay: false,
  loop: false,
  className: "mb-12 xl:mb-14 pt-1"
};

/**
 * Brand Carousel Configuration
 * Brand logos carousel
 */
const brandCarouselConfig = {
  items: [], // {id, mediaType: 'image', imageDesktop?, imageMobile?, link?, title?}
  variant: "brand" as const,
  breakpointMode: "simplified" as const, // 'simplified' | 'advanced'
  itemsToShow: {
    desktop: 10.5,
    tablet: 6.5,
    mobile: 3.5
  },
  breakpointsJSON: {
    "1536": { slidesPerView: 10.5, spaceBetween: 20 },
    "1280": { slidesPerView: 8.5, spaceBetween: 16 },
    "1024": { slidesPerView: 6.5, spaceBetween: 16 },
    "768": { slidesPerView: 4.5, spaceBetween: 16 },
    "520": { slidesPerView: 4.5, spaceBetween: 12 },
    "0": { slidesPerView: 3.5, spaceBetween: 5 }
  },
  cardStyle: {
    borderWidth: 0,
    borderColor: "#EAEEF2",
    borderStyle: "solid" as const,
    borderRadius: "md" as const,
    shadowSize: "none" as const,
    shadowColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#ffffff",
    hoverEffect: "none" as const,
    hoverScale: 1.02,
    hoverShadowSize: "lg" as const,
    hoverBackgroundColor: ""
  },
  autoplay: false,
  loop: false,
  className: "mb-12 xl:mb-14 pt-1"
};

/**
 * Flyer Carousel Configuration
 * Flyer/catalog images carousel
 */
const flyerCarouselConfig = {
  items: [], // {id, mediaType: 'image', imageDesktop?, imageMobile?, link?, title?}
  variant: "flyer" as const,
  breakpointMode: "simplified" as const, // 'simplified' | 'advanced'
  itemsToShow: {
    desktop: 5,
    tablet: 4,
    mobile: 2
  },
  breakpointsJSON: {
    "1536": { slidesPerView: 5, spaceBetween: 20 },
    "1280": { slidesPerView: 5, spaceBetween: 16 },
    "1024": { slidesPerView: 5, spaceBetween: 16 },
    "768": { slidesPerView: 4, spaceBetween: 16 },
    "520": { slidesPerView: 4, spaceBetween: 12 },
    "0": { slidesPerView: 2, spaceBetween: 5 }
  },
  cardStyle: {
    borderWidth: 0,
    borderColor: "#EAEEF2",
    borderStyle: "solid" as const,
    borderRadius: "md" as const,
    shadowSize: "none" as const,
    shadowColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#ffffff",
    hoverEffect: "none" as const,
    hoverScale: 1.02,
    hoverShadowSize: "lg" as const,
    hoverBackgroundColor: ""
  },
  autoplay: false,
  loop: false,
  className: "mb-12 xl:mb-14 pt-1"
};

/**
 * Product Carousel Configuration
 * Display products by mode: wishlist (requires login), trending, category, or custom query
 */
const productCarouselConfig = {
  title: "Featured Products",
  items: [],
  searchQuery: "",
  limit: 12,
  dataSource: "search" as const,
  breakpointMode: "simplified" as const,
  itemsToShow: {
    desktop: 4,
    tablet: 3,
    mobile: 1
  },
  breakpointsJSON: {
    "1536": { slidesPerView: 4, spaceBetween: 16 },
    "1280": { slidesPerView: 4, spaceBetween: 16 },
    "1024": { slidesPerView: 3, spaceBetween: 16 },
    "768": { slidesPerView: 2, spaceBetween: 12 },
    "520": { slidesPerView: 1, spaceBetween: 8 },
    "0": { slidesPerView: 1, spaceBetween: 6 }
  },
  autoplay: false,
  autoplaySpeed: 5000,
  loop: false,
  showDots: true,
  showArrows: true,
  className: "mb-12 xl:mb-14 pt-1"
};

export const BLOCK_REGISTRY: BlockRegistry = {
  hero: {
    id: "hero",
    name: "Hero Section",
    category: "headers",
    variants: {
      fullWidth: {
        id: "hero-full-width",
        label: "Full Width Hero",
        icon: "🖼️",
        defaultConfig: heroFullWidthDefault
      },
      split: {
        id: "hero-split",
        label: "Split Hero",
        icon: "📱",
        defaultConfig: heroSplitDefault
      },
      carousel: {
        id: "hero-carousel",
        label: "Carousel Hero",
        icon: "🎠",
        defaultConfig: heroCarouselDefault
      }
    }
  },
  product: {
    id: "product",
    name: "Product Section",
    category: "commerce",
    variants: {
      slider: {
        id: "product-slider",
        label: "Product Slider",
        icon: "🛍️",
        defaultConfig: productSliderDefault
      },
      grid: {
        id: "product-grid",
        label: "Product Grid",
        icon: "📦",
        defaultConfig: productGridDefault
      }
    }
  },
  category: {
    id: "category",
    name: "Category Section",
    category: "navigation",
    variants: {
      grid: {
        id: "category-grid",
        label: "Category Grid",
        icon: "📑",
        defaultConfig: categoryGridDefault
      },
      carousel: {
        id: "category-carousel",
        label: "Category Carousel",
        icon: "🎪",
        defaultConfig: categoryCarouselDefault
      }
    }
  },
  content: {
    id: "content",
    name: "Content Section",
    category: "content",
    variants: {
      richText: {
        id: "content-rich-text",
        label: "Rich Text",
        icon: "📝",
        defaultConfig: contentRichTextDefault
      },
      features: {
        id: "content-features",
        label: "Feature Grid",
        icon: "⭐",
        defaultConfig: contentFeaturesDefault
      },
      testimonials: {
        id: "content-testimonials",
        label: "Testimonials",
        icon: "💬",
        defaultConfig: contentTestimonialsDefault
      },
      customHtml: {
        id: "content-custom-html",
        label: "Custom HTML",
        icon: "🧩",
        defaultConfig: contentCustomHtmlDefault
      }
    }
  },
  media: {
    id: "media",
    name: "Media Section",
    category: "media",
    variants: {
      youtubeEmbed: {
        id: "youtubeEmbed",
        label: "YouTube Video",
        icon: "🎥",
        defaultConfig: {
          url: "",
          title: "Product Video",
          autoplay: false,
          width: "100%",
          height: "450px"
        }
      },
      mediaImage: {
        id: "media-image",
        label: "Media Image",
        icon: "🖼️",
        defaultConfig: {
          title: "",
          imageUrl: "",
          alt: "Product image",
          linkUrl: "",
          openInNewTab: true,
          width: "100%",
          maxWidth: "800px",
          alignment: "center",
          className: "mb-12 xl:mb-14 pt-1",
          style: {
            borderWidth: 0,
            borderColor: "#EAEEF2",
            borderStyle: "solid",
            borderRadius: "md",
            shadowSize: "none",
            shadowColor: "rgba(0, 0, 0, 0.15)",
            backgroundColor: "#ffffff",
            hoverEffect: "none",
            hoverScale: 1.02,
            hoverShadowSize: "lg",
            hoverBackgroundColor: ""
          }
        }
      }
    }
  },
  productDetail: {
    id: "productDetail",
    name: "Product Detail Enhancements",
    category: "content",
    variants: {
      dataTable: {
        id: "product-data-table",
        label: "Data Table",
        icon: "📋",
        defaultConfig: productDataTableDefault
      }
    }
  },
  carousel: {
    id: "carousel",
    name: "Carousel Section",
    category: "content",
    variants: {
      heroWithWidgets: {
        id: "hero-with-widgets",
        label: "Hero with Widgets (80/20)",
        icon: "🎯",
        defaultConfig: heroWithWidgetsConfig
      },
      heroCarousel: {
        id: "carousel-hero",
        label: "Media Carousel",
        icon: "🎠",
        defaultConfig: heroCarouselConfig
      },
      promoCarousel: {
        id: "carousel-promo",
        label: "Promo Carousel",
        icon: "🎯",
        hidden: true,
        defaultConfig: promoCarouselConfig
      },
      brandCarousel: {
        id: "carousel-brand",
        label: "Brand Carousel",
        icon: "🏷️",
        hidden: true,
        defaultConfig: brandCarouselConfig
      },
      flyerCarousel: {
        id: "carousel-flyer",
        label: "Flyer Carousel",
        icon: "📰",
        hidden: true,
        defaultConfig: flyerCarouselConfig
      },
      productCategories: {
        id: "carousel-products",
        label: "Product Carousel",
        icon: "📦",
        defaultConfig: productCarouselConfig
      },
      productGallery: {
        id: "carousel-gallery",
        label: "Product Gallery",
        icon: "🖼️",
        defaultConfig: productGalleryConfig
      }
    }
  }
};

export const getAllBlockTemplates = () =>
  Object.values(BLOCK_REGISTRY).flatMap((section) => Object.values(section.variants));

export const getBlockTemplate = (variantId: string) => {
  for (const section of Object.values(BLOCK_REGISTRY)) {
    const variant = Object.values(section.variants).find((item) => item.id === variantId);
    if (variant) {
      return variant;
    }
  }
  return null;
};

export const DEFAULT_HOME_BLOCKS = [
  {
    id: "hero-default",
    type: "hero-full-width",
    order: 0,
    config: heroFullWidthDefault
  },
  {
    id: "categories-default",
    type: "category-grid",
    order: 1,
    config: {
      ...categoryGridDefault,
      categories: [
        {
          id: "hydronics",
          name: "Hydronic Heating",
          image: "https://images.unsplash.com/photo-1620825141088-a824daf6a46b?auto=format&fit=crop&w=640&q=80",
          link: "/categories/hydronics"
        },
        {
          id: "bathroom",
          name: "Bathroom Suites",
          image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=80",
          link: "/categories/bathroom"
        },
        {
          id: "kitchen",
          name: "Kitchen Tapware",
          image: "https://images.unsplash.com/photo-1581166397057-235af2b3c6dd?auto=format&fit=crop&w=640&q=80",
          link: "/categories/kitchen"
        },
        {
          id: "tools",
          name: "Service Tools",
          image: "https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec?auto=format&fit=crop&w=640&q=80",
          link: "/categories/tools"
        }
      ]
    }
  },
  {
    id: "products-default",
    type: "product-slider",
    order: 2,
    config: productSliderDefault
  },
  {
    id: "content-default",
    type: "content-features",
    order: 3,
    config: contentFeaturesDefault
  }
];
