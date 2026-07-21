import { BlockRegistry, type PageBlock } from "./types.js";
export declare const BLOCK_REGISTRY: BlockRegistry;
export declare const getAllBlockTemplates: () => any[];
export declare const getBlockTemplate: (variantId: string) => any;
export declare const DEFAULT_HOME_BLOCKS: ({
    id: string;
    type: string;
    order: number;
    config: {
        variant: "fullWidth";
        title: string;
        subtitle?: string;
        cta?: import("./types.js").HeroBlockCTA;
        background: import("./types.js").HeroBackgroundImage;
        textAlign: "left" | "center" | "right";
        height: "small" | "medium" | "large";
        overlay?: number;
    };
} | {
    id: string;
    type: string;
    order: number;
    config: {
        categories: {
            id: string;
            name: string;
            image: string;
            link: string;
        }[];
        variant: "grid";
        title?: string;
        layout: "grid" | "masonry";
        columns: {
            mobile: number;
            tablet: number;
            desktop: number;
        };
        showImage?: boolean;
        showCount?: boolean;
        imageAspectRatio?: "1:1" | "4:3" | "3:2" | "16:9";
    };
} | {
    id: string;
    type: string;
    order: number;
    config: import("./types.js").ProductSliderSettings;
} | {
    id: string;
    type: string;
    order: number;
    config: import("./types.js").ContentFeaturesConfig;
})[];
export declare const resolveDefaultBlocks: () => PageBlock[];
/** Block variants available in the custom-page builder. */
export declare const PAGE_BLOCKS: readonly ["hero-full-width", "hero-split", "hero-with-widgets", "carousel-hero", "carousel-products", "carousel-gallery", "content-rich-text", "content-custom-html", "youtubeEmbed", "media-image", "form-contact"];
/** Block variants available in the home builder (no forms on home). */
export declare const HOME_PAGE_BLOCKS: ("youtubeEmbed" | "hero-full-width" | "hero-split" | "content-rich-text" | "content-custom-html" | "media-image" | "hero-with-widgets" | "carousel-hero" | "carousel-products" | "carousel-gallery")[];
/** Blocks available for blog posts (same content set as custom pages).
 *  Copied verbatim from CS `app/b2b/(builder)/blog-builder/page.tsx`'s BLOG_BLOCKS. */
export declare const BLOG_BLOCKS: readonly ["hero-full-width", "hero-split", "carousel-gallery", "content-rich-text", "content-custom-html", "youtubeEmbed", "media-image", "form-contact"];
//# sourceMappingURL=registry.d.ts.map