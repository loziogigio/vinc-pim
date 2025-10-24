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
}

export interface HomeSettings {
  _id: string;
  customerId: string;
  branding: CompanyBranding;
  defaultCardVariant: "b2b" | "horizontal" | "compact" | "detailed";
  cardStyle: ProductCardStyle;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastModifiedBy?: string;
}
