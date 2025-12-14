export type CTAStyle = "primary" | "secondary" | "outline";

export type HeroBlockVariant = "fullWidth" | "split" | "carousel";

export interface HeroBlockCTA {
  text: string;
  link: string;
  style?: CTAStyle;
}

export interface HeroBackgroundImage {
  type: "image";
  src: string;
  alt: string;
}

export type HeroBlockConfig =
  | {
      variant: "fullWidth";
      title: string;
      subtitle?: string;
      cta?: HeroBlockCTA;
      background: HeroBackgroundImage;
      textAlign: "left" | "center" | "right";
      height: "small" | "medium" | "large";
      overlay?: number;
    }
  | {
      variant: "split";
      title: string;
      subtitle?: string;
      cta?: HeroBlockCTA;
      image: string;
      imagePosition: "left" | "right";
      backgroundColor?: string;
    }
  | {
      variant: "carousel";
      slides: Array<{
        title: string;
        subtitle?: string;
        cta?: HeroBlockCTA;
        image: string;
      }>;
      autoplay?: boolean;
      interval?: number;
      showDots?: boolean;
      showArrows?: boolean;
      cardStyle?: MediaCardStyle;
    };

export type ProductBlockVariant = "slider" | "grid";

export interface ProductBlockConfigCommon {
  variant: ProductBlockVariant;
  title?: string;
  subtitle?: string;
  collection: string;
  limit: number;
  columns: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface ProductSliderSettings extends ProductBlockConfigCommon {
  variant: "slider";
  showBadges?: boolean;
  showQuickAdd?: boolean;
  slidesPerView: number;
  spaceBetween: number;
}

export interface ProductGridSettings extends ProductBlockConfigCommon {
  variant: "grid";
  showFilters?: boolean;
  showSort?: boolean;
  pagination?: "none" | "pager" | "infinite-scroll";
}

export type ProductBlockConfig = ProductSliderSettings | ProductGridSettings;

export type CategoryBlockVariant = "grid" | "carousel";

export interface CategoryItem {
  id: string;
  name: string;
  image?: string;
  link?: string;
  productCount?: number;
}

export interface CategoryGridConfig {
  variant: "grid";
  title?: string;
  categories: CategoryItem[];
  layout: "grid" | "masonry";
  columns: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  showImage?: boolean;
  showCount?: boolean;
  imageAspectRatio?: "1:1" | "4:3" | "3:2" | "16:9";
}

export interface CategoryCarouselConfig {
  variant: "carousel";
  title?: string;
  categories: CategoryItem[];
  slidesPerView: number;
  showImage?: boolean;
}

export type CategoryBlockConfig = CategoryGridConfig | CategoryCarouselConfig;

export type ContentBlockVariant = "richText" | "features" | "testimonials" | "customHtml";

export interface ContentRichTextConfig {
  variant: "richText";
  content: string;
  width: "full" | "contained";
  textAlign: "left" | "center" | "right";
  padding: "none" | "small" | "medium" | "large";
}

export interface ContentFeatureItem {
  icon?: string;
  title: string;
  description?: string;
}

export interface ContentFeaturesConfig {
  variant: "features";
  title?: string;
  features: ContentFeatureItem[];
  columns: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface ContentTestimonialItem {
  quote: string;
  author: string;
  role?: string;
  avatarUrl?: string;
  rating?: number;
}

export interface ContentTestimonialsConfig {
  variant: "testimonials";
  title?: string;
  testimonials: ContentTestimonialItem[];
  layout: "carousel" | "grid";
  showRating?: boolean;
  showAvatar?: boolean;
}

export interface ContentCustomHtmlConfig {
  variant: "customHtml";
  html: string;
}

export type ContentBlockConfig =
  | ContentRichTextConfig
  | ContentFeaturesConfig
  | ContentTestimonialsConfig
  | ContentCustomHtmlConfig;

export interface YouTubeEmbedConfig {
  url: string;
  title?: string;
  autoplay?: boolean;
  width?: string;
  height?: string;
}

export interface MediaCardStyle {
  borderWidth: number;
  borderColor: string;
  borderStyle: "solid" | "dashed" | "dotted" | "none";
  borderRadius: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  shadowSize: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
  shadowColor: string;
  backgroundColor: string;
  hoverEffect: "none" | "lift" | "shadow" | "scale" | "border" | "glow";
  hoverScale?: number;
  hoverShadowSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  hoverBackgroundColor?: string;
}

export interface MediaImageBlockConfig {
  title?: string;
  imageUrl: string;
  alt?: string;
  linkUrl?: string;
  openInNewTab?: boolean;
  width?: string;
  maxWidth?: string;
  alignment?: "left" | "center" | "right";
  style?: MediaCardStyle;
  className?: string;
}

export type ProductDataTableValueType = "text" | "html" | "image";

export interface ProductDataTableRowLinkConfig {
  url: string;
  openInNewTab?: boolean;
  rel?: string;
}

export interface ProductDataTableRowConfig {
  id?: string;
  label: string;
  leftValueType?: ProductDataTableValueType;
  valueType?: ProductDataTableValueType;
  value?: string;
  html?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageAspectRatio?: string;
  leftHtml?: string;
  leftLink?: ProductDataTableRowLinkConfig;
  leftHelperText?: string;
  valueImageUrl?: string;
  valueImageAlt?: string;
  valueImageAspectRatio?: string;
  link?: ProductDataTableRowLinkConfig;
  helperText?: string;
  highlight?: boolean;
}

export interface ProductDataTableAppearance {
  bordered?: boolean;
  rounded?: boolean;
  zebraStripes?: boolean;
}

export interface ProductDataTableBlockConfig {
  variant: "productDataTable";
  title?: string;
  description?: string;
  labelColumnWidth?: number;
  appearance?: ProductDataTableAppearance;
  rows: ProductDataTableRowConfig[];
}

export type MediaOverlayPosition = "top" | "middle" | "bottom";
export type MediaOverlayAlign = "left" | "center" | "right";

export interface HeroCarouselOverlay {
  position?: MediaOverlayPosition;
  align?: MediaOverlayAlign;
  textColor?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
}

export interface HeroCarouselSlide {
  id: string;
  title?: string;
  imageDesktop?: { url: string; alt?: string };
  imageMobile?: { url: string; alt?: string };
  link?: { url: string; openInNewTab?: boolean };
  overlay?: HeroCarouselOverlay;
}

export interface HeroCarouselBlockConfig {
  title?: string;
  slides: HeroCarouselSlide[];
  breakpointMode: "simplified" | "advanced";
  itemsToShow?: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
  breakpointsJSON?: Record<string, unknown>;
  autoplay?: boolean;
  autoplaySpeed?: number;
  loop?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  cardStyle?: MediaCardStyle;
  className?: string;
}

export interface MediaCarouselItem {
  id: string;
  mediaType?: "image" | "video";
  imageDesktop?: { url: string; alt?: string };
  imageMobile?: { url: string; alt?: string };
  videoUrl?: string;
  link?: { url: string; openInNewTab?: boolean };
  title?: string;
}

export interface MediaCarouselBlockConfig {
  items: MediaCarouselItem[];
  variant?: "promo" | "brand" | "flyer" | "products" | "gallery";
  breakpointMode: "simplified" | "advanced";
  itemsToShow?: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
  breakpointsJSON?: Record<string, unknown>;
  autoplay?: boolean;
  loop?: boolean;
  cardStyle?: MediaCardStyle;
  className?: string;
}

export type MediaBlockConfig = YouTubeEmbedConfig | MediaImageBlockConfig;

export type BlockConfig =
  | HeroBlockConfig
  | ProductBlockConfig
  | CategoryBlockConfig
  | ContentBlockConfig
  | MediaBlockConfig
  | HeroCarouselBlockConfig
  | MediaCarouselBlockConfig
  | ProductDataTableBlockConfig;

export interface BlockVariantDefinition<TConfig extends BlockConfig> {
  id: string;
  label: string;
  icon: string;
  defaultConfig: TConfig;
  hidden?: boolean;
}

export interface BlockFamily<
  TVariants extends Record<string, BlockVariantDefinition<BlockConfig>>
> {
  id: string;
  name: string;
  category: "headers" | "commerce" | "navigation" | "content" | "media";
  variants: TVariants;
}

export type BlockRegistry = {
  hero: BlockFamily<{
    fullWidth: BlockVariantDefinition<Extract<HeroBlockConfig, { variant: "fullWidth" }>>;
    split: BlockVariantDefinition<Extract<HeroBlockConfig, { variant: "split" }>>;
    carousel: BlockVariantDefinition<Extract<HeroBlockConfig, { variant: "carousel" }>>;
  }>;
  product: BlockFamily<{
    slider: BlockVariantDefinition<Extract<ProductBlockConfig, { variant: "slider" }>>;
    grid: BlockVariantDefinition<Extract<ProductBlockConfig, { variant: "grid" }>>;
  }>;
  category: BlockFamily<{
    grid: BlockVariantDefinition<Extract<CategoryBlockConfig, { variant: "grid" }>>;
    carousel: BlockVariantDefinition<Extract<CategoryBlockConfig, { variant: "carousel" }>>;
  }>;
  content: BlockFamily<{
    richText: BlockVariantDefinition<Extract<ContentBlockConfig, { variant: "richText" }>>;
    features: BlockVariantDefinition<Extract<ContentBlockConfig, { variant: "features" }>>;
    testimonials: BlockVariantDefinition<Extract<ContentBlockConfig, { variant: "testimonials" }>>;
    customHtml: BlockVariantDefinition<Extract<ContentBlockConfig, { variant: "customHtml" }>>;
  }>;
  media: BlockFamily<{
    youtubeEmbed: BlockVariantDefinition<YouTubeEmbedConfig>;
    mediaImage: BlockVariantDefinition<MediaImageBlockConfig>;
  }>;
  productDetail: BlockFamily<{
    dataTable: BlockVariantDefinition<ProductDataTableBlockConfig>;
  }>;
  carousel: BlockFamily<{
    heroWithWidgets: BlockVariantDefinition<HeroCarouselBlockConfig>;
    heroCarousel: BlockVariantDefinition<HeroCarouselBlockConfig>;
    promoCarousel: BlockVariantDefinition<MediaCarouselBlockConfig>;
    brandCarousel: BlockVariantDefinition<MediaCarouselBlockConfig>;
    flyerCarousel: BlockVariantDefinition<MediaCarouselBlockConfig>;
    productCategories: BlockVariantDefinition<MediaCarouselBlockConfig>;
    productGallery: BlockVariantDefinition<MediaCarouselBlockConfig>;
  }>;
};

// Zone types for product detail page placement
export type ProductDetailZone = "zone1" | "zone2" | "zone3" | "zone4";

export interface PageBlock<TConfig extends BlockConfig = BlockConfig> {
  id: string;
  type: string;
  order: number;
  config: TConfig;
  metadata?: Record<string, unknown>;
  // NEW: Zone placement for product detail pages
  zone?: ProductDetailZone;
  // NEW: Tab label for zone3 (new tab placement)
  tabLabel?: string;
  tabIcon?: string;
}

export interface PageSEOSettings {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  image?: string;
}

export interface PageVersionAttributes {
  region?: string;
  language?: string;
  device?: string;
  addressStates?: string[];
  [key: string]: string | string[] | undefined;
}

export interface PageVersionTags {
  campaign?: string;
  segment?: string;
  attributes?: PageVersionAttributes;
}

// Version in history (can be draft or published)
export interface PageVersion {
  version: number;
  blocks: PageBlock[];
  seo?: PageSEOSettings;
  status: "draft" | "published";
  label?: string;
  createdAt: string;
  lastSavedAt: string;
  publishedAt?: string;
  createdBy?: string;
  comment?: string;
  tag?: string;
  tags?: PageVersionTags;
  priority?: number;
  isDefault?: boolean;
  activeFrom?: string;
  activeTo?: string;
}

export interface PageConfig {
  slug: string;
  name: string;
  // All versions (both draft and published)
  versions: PageVersion[];
  // Current working version number
  currentVersion: number;
  // Latest published version number
  currentPublishedVersion?: number;
  updatedAt: string;
  createdAt: string;
  // Deprecated fields
  draft?: {
    blocks: PageBlock[];
    seo?: PageSEOSettings;
    basedOnVersion?: number;
    lastSavedAt: string;
    lastSavedBy?: string;
  };
  publishedVersions?: PageVersion[];
  published?: boolean;
  status?: "draft" | "published";
  publishedVersion?: number;
}
