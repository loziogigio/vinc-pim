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

export type ContentBlockVariant = "richText" | "features" | "testimonials";

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

export type ContentBlockConfig =
  | ContentRichTextConfig
  | ContentFeaturesConfig
  | ContentTestimonialsConfig;

export type BlockConfig =
  | HeroBlockConfig
  | ProductBlockConfig
  | CategoryBlockConfig
  | ContentBlockConfig;

export interface BlockVariantDefinition<TConfig extends BlockConfig> {
  id: string;
  label: string;
  icon: string;
  defaultConfig: TConfig;
}

export interface BlockFamily<
  TVariants extends Record<string, BlockVariantDefinition<BlockConfig>>
> {
  id: string;
  name: string;
  category: "headers" | "commerce" | "navigation" | "content";
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
  }>;
};

export interface PageBlock<TConfig extends BlockConfig = BlockConfig> {
  id: string;
  type: string;
  order: number;
  config: TConfig;
  metadata?: Record<string, unknown>;
}

export interface PageSEOSettings {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  image?: string;
}

export interface PageConfig {
  slug: string;
  name: string;
  blocks: PageBlock[];
  seo?: PageSEOSettings;
  updatedAt: string;
  createdAt: string;
  published?: boolean;
}
