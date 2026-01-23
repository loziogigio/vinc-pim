export type ProductCardBorderStyle = "solid" | "dashed" | "dotted" | "none";
export type ProductCardShadowSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl";
export type ProductCardRadius = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
export type ProductCardHoverEffect = "none" | "lift" | "shadow" | "scale" | "border" | "glow";
export type ProductCardHoverShadowSize = "sm" | "md" | "lg" | "xl" | "2xl";

export interface ProductCardStyle {
  borderWidth: number;
  borderColor: string;
  borderStyle: ProductCardBorderStyle;
  shadowSize: ProductCardShadowSize;
  shadowColor: string;
  borderRadius: ProductCardRadius;
  hoverEffect: ProductCardHoverEffect;
  hoverScale?: number;
  hoverShadowSize?: ProductCardHoverShadowSize;
  backgroundColor: string;
  hoverBackgroundColor?: string;
}

// Media card style (for banners, carousels, etc.) - uses same structure as ProductCardStyle
export type MediaCardStyle = ProductCardStyle;

export interface CompanyBranding {
  title: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  /** Shop/Storefront URL for email redirects (e.g., https://shop.hidros.com) */
  shopUrl?: string;
  /** Company website URL (e.g., https://www.hidros.com) */
  websiteUrl?: string;

  // Extended theming colors
  /** Accent color for buttons, links, CTAs */
  accentColor?: string;
  /** Main body text color (default: #000000) */
  textColor?: string;
  /** Secondary/muted text color (default: #595959) */
  mutedColor?: string;
  /** Page background color (default: #ffffff) */
  backgroundColor?: string;
  /** Header background color (empty = transparent/inherit) */
  headerBackgroundColor?: string;
  /** Footer background color (default: #f5f5f5) */
  footerBackgroundColor?: string;
  /** Footer text color (default: #666666) */
  footerTextColor?: string;
}

export interface CDNConfiguration {
  /** Base CDN URL (e.g., https://s3.eu-de.cloud-object-storage.appdomain.cloud/eatit) */
  baseUrl?: string;
  /** Description for admin reference (e.g., "IBM Cloud Object Storage - EU") */
  description?: string;
  /** Enable/disable CDN usage (falls back to environment variable if disabled) */
  enabled?: boolean;
}

/**
 * CDN Credentials for file uploads
 * Stored in MongoDB homesettings for global access
 */
export interface CDNCredentials {
  /** CDN endpoint URL (e.g., cloud-object-storage.appdomain.cloud) */
  cdn_url?: string;
  /** CDN bucket region (e.g., eu-de) */
  bucket_region?: string;
  /** Bucket name (e.g., hidros) */
  bucket_name?: string;
  /** Folder path within the bucket (e.g., eshop) */
  folder_name?: string;
  /** CDN access key ID */
  cdn_key?: string;
  /** CDN secret access key */
  cdn_secret?: string;
  /** Signed URL expiry time in seconds (0 = no expiry/public) */
  signed_url_expiry?: number;
  /** Delete files from cloud when removed from database */
  delete_from_cloud?: boolean;
}

/**
 * SMTP Settings for email sending
 */
export interface SMTPSettings {
  /** SMTP host (e.g., smtp.hostinger.com) */
  host?: string;
  /** SMTP port (e.g., 587) */
  port?: number;
  /** Use secure connection (TLS) */
  secure?: boolean;
  /** SMTP username */
  user?: string;
  /** SMTP password */
  password?: string;
  /** From email address */
  from?: string;
  /** From display name */
  from_name?: string;
  /** Default recipient for system notifications */
  default_to?: string;
}

// ============================================================================
// SEO Meta Tags
// ============================================================================

/**
 * SEO Meta Tags configuration for the storefront
 * Used for search engines and social media sharing
 */
export interface MetaTags {
  /** Page title (appears in browser tab and search results) */
  title?: string;
  /** Meta description for search engines (max 160 chars recommended) */
  description?: string;
  /** Meta keywords (comma-separated, less important for modern SEO) */
  keywords?: string;
  /** Author of the website content */
  author?: string;
  /** Robots directive (e.g., "index, follow" or "noindex, nofollow") */
  robots?: string;
  /** Canonical URL for the homepage */
  canonicalUrl?: string;

  // Open Graph (Facebook, LinkedIn, etc.)
  /** OG title (defaults to title if not set) */
  ogTitle?: string;
  /** OG description (defaults to description if not set) */
  ogDescription?: string;
  /** OG image URL for social sharing (1200x630 recommended) */
  ogImage?: string;
  /** OG site name */
  ogSiteName?: string;
  /** OG type (website, article, product, etc.) */
  ogType?: string;

  // Twitter Card
  /** Twitter card type (summary, summary_large_image, etc.) */
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  /** Twitter @username of the site */
  twitterSite?: string;
  /** Twitter @username of the content creator */
  twitterCreator?: string;
  /** Twitter image URL (defaults to ogImage if not set) */
  twitterImage?: string;

  // Structured Data
  /** JSON-LD structured data for the organization (stringified JSON) */
  structuredData?: string;

  // Additional meta
  /** Theme color for mobile browsers (e.g., "#009f7f") */
  themeColor?: string;
  /** Google site verification code */
  googleSiteVerification?: string;
  /** Bing site verification code */
  bingSiteVerification?: string;
}

// ============================================================================
// Header Builder Types
// ============================================================================

/**
 * Layout presets with actual width percentages
 * Based on vinc-b2b header analysis: logo 20% | search 60% | icons 20%
 */
export type RowLayout =
  | "full"           // 1 block: 100%
  | "50-50"          // 2 blocks: 50% / 50%
  | "33-33-33"       // 3 blocks: 33% / 33% / 33%
  | "20-60-20"       // 3 blocks: 20% / 60% / 20% (main header style)
  | "25-50-25"       // 3 blocks: 25% / 50% / 25%
  | "30-40-30";      // 3 blocks: 30% / 40% / 30%

/** Width percentages for each layout preset */
export const LAYOUT_WIDTHS: Record<RowLayout, number[]> = {
  "full": [100],
  "50-50": [50, 50],
  "33-33-33": [33.33, 33.33, 33.33],
  "20-60-20": [20, 60, 20],
  "25-50-25": [25, 50, 25],
  "30-40-30": [30, 40, 30],
};

/** CSS classes for each layout preset (Tailwind) */
export const LAYOUT_CSS: Record<RowLayout, string[]> = {
  "full": ["w-full"],
  "50-50": ["w-[50%]", "w-[50%]"],
  "33-33-33": ["w-[33.33%]", "w-[33.33%]", "w-[33.33%]"],
  "20-60-20": ["w-[20%]", "w-[60%]", "w-[20%]"],
  "25-50-25": ["w-[25%]", "w-[50%]", "w-[25%]"],
  "30-40-30": ["w-[30%]", "w-[40%]", "w-[30%]"],
};

/** Block count for each layout */
export const LAYOUT_BLOCK_COUNT: Record<RowLayout, number> = {
  "full": 1,
  "50-50": 2,
  "33-33-33": 3,
  "20-60-20": 3,
  "25-50-25": 3,
  "30-40-30": 3,
};

/** Available header widget types */
export type HeaderWidgetType =
  | "logo"
  | "search-bar"
  | "radio-widget"
  | "category-menu"
  | "cart"
  | "company-info"
  | "no-price"
  | "favorites"
  | "compare"
  | "profile"
  | "button"
  | "spacer"
  | "divider";

/** Block alignment within the header */
export type BlockAlignment = "left" | "center" | "right";

// Widget Configuration Interfaces
// --------------------------------

export interface LogoWidgetConfig {
  width?: number;
  height?: number;
  showTitle?: boolean;
}

export interface SearchBarWidgetConfig {
  placeholder?: string;
  width?: "sm" | "md" | "lg" | "full";
}

/** A single radio station configuration */
export interface RadioStation {
  id: string;
  name: string;
  logoUrl: string;
  streamUrl: string;
}

export interface RadioWidgetConfig {
  enabled: boolean;
  /** Icon/image URL shown in the header for the radio button */
  headerIcon?: string;
  stations: RadioStation[];
  /** @deprecated Use stations array instead */
  links?: { label: string; url: string }[];
}

export interface CategoryMenuWidgetConfig {
  menuId?: string;
  label?: string;
  icon?: string;
}

export interface ButtonWidgetConfig {
  label: string;
  url: string;
  variant: "primary" | "secondary" | "outline" | "ghost";
  icon?: string;
}

export interface IconWidgetConfig {
  showLabel?: boolean;
  showBadge?: boolean;
}

export interface CompanyInfoWidgetConfig {
  showDeliveryAddress?: boolean;
  showBalance?: boolean;
}

export interface SpacerWidgetConfig {
  width?: number;
}

export interface DividerWidgetConfig {
  height?: number;
  color?: string;
}

/** Union type for all widget configurations */
export type WidgetConfig =
  | LogoWidgetConfig
  | SearchBarWidgetConfig
  | RadioWidgetConfig
  | CategoryMenuWidgetConfig
  | ButtonWidgetConfig
  | IconWidgetConfig
  | CompanyInfoWidgetConfig
  | SpacerWidgetConfig
  | DividerWidgetConfig
  | Record<string, unknown>;

/** A single widget in the header */
export interface HeaderWidget {
  id: string;
  type: HeaderWidgetType;
  config: WidgetConfig;
}

/** A block within a header row (contains widgets) */
export interface HeaderBlock {
  id: string;
  alignment: BlockAlignment;
  widgets: HeaderWidget[];
}

/** A row in the header (contains blocks) */
export interface HeaderRow {
  id: string;
  enabled: boolean;
  fixed: boolean;
  backgroundColor?: string;
  textColor?: string;
  height?: number;
  layout: RowLayout;
  blocks: HeaderBlock[];
}

/** Complete header configuration */
export interface HeaderConfig {
  rows: HeaderRow[];
}

/** Widget library metadata for UI */
export interface WidgetLibraryItem {
  label: string;
  icon: string;
  description: string;
  /** Whether multiple instances are allowed */
  allowMultiple?: boolean;
}

export const HEADER_WIDGET_LIBRARY: Record<HeaderWidgetType, WidgetLibraryItem> = {
  "logo": { label: "Logo", icon: "Image", description: "Company logo" },
  "search-bar": { label: "Search Bar", icon: "Search", description: "Product search" },
  "radio-widget": { label: "Radio Widget", icon: "Radio", description: "Radio player with links" },
  "category-menu": { label: "Category Menu", icon: "Menu", description: "Categories dropdown" },
  "cart": { label: "Cart", icon: "ShoppingCart", description: "Shopping cart" },
  "company-info": { label: "Company Info", icon: "Building2", description: "Delivery address, balance" },
  "no-price": { label: "No Price", icon: "EyeOff", description: "Toggle price visibility" },
  "favorites": { label: "Favorites", icon: "Heart", description: "Wishlist" },
  "compare": { label: "Compare", icon: "GitCompare", description: "Product comparison" },
  "profile": { label: "Profile", icon: "User", description: "User profile/login" },
  "button": { label: "Button", icon: "Square", description: "Custom button/link", allowMultiple: true },
  "spacer": { label: "Spacer", icon: "Space", description: "Flexible space", allowMultiple: true },
  "divider": { label: "Divider", icon: "Minus", description: "Vertical divider", allowMultiple: true },
};

// ============================================================================
// Home Settings Document
// ============================================================================

export interface HomeSettings {
  _id: string;
  customerId: string;
  branding: CompanyBranding;
  defaultCardVariant: "b2b" | "horizontal" | "compact" | "detailed";
  cardStyle: ProductCardStyle;
  cdn?: CDNConfiguration;
  cdn_credentials?: CDNCredentials;
  smtp_settings?: SMTPSettings;
  /** Custom footer HTML content (published version, sanitized with DOMPurify on render) */
  footerHtml?: string;
  /** Draft footer HTML content (for preview before publishing) */
  footerHtmlDraft?: string;
  /** Header builder configuration (published version) */
  headerConfig?: HeaderConfig;
  /** Draft header configuration (for preview before publishing) */
  headerConfigDraft?: HeaderConfig;
  /** SEO meta tags configuration */
  meta_tags?: MetaTags;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastModifiedBy?: string;
}
