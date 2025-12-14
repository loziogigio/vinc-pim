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

export interface HomeSettings {
  _id: string;
  customerId: string;
  branding: CompanyBranding;
  defaultCardVariant: "b2b" | "horizontal" | "compact" | "detailed";
  cardStyle: ProductCardStyle;
  cdn?: CDNConfiguration;
  cdn_credentials?: CDNCredentials;
  smtp_settings?: SMTPSettings;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastModifiedBy?: string;
}
