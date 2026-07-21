export declare const SCRIPT_PLACEMENTS: readonly ["head", "body_end"];
export type ScriptPlacement = (typeof SCRIPT_PLACEMENTS)[number];
export declare const SCRIPT_LOADING_STRATEGIES: readonly ["async", "defer", "blocking"];
export type ScriptLoadingStrategy = (typeof SCRIPT_LOADING_STRATEGIES)[number];
export interface IB2CCustomScript {
    /** Human-readable label (e.g., "Google Analytics", "Iubenda") */
    label: string;
    /** External script URL (e.g., https://www.googletagmanager.com/gtag/js?id=G-XXX) */
    src?: string;
    /** Inline script content (e.g., gtag('config', 'G-XXX')) — can be combined with src */
    inline_code?: string;
    /** Where to inject: head (default) or body_end */
    placement: ScriptPlacement;
    /** Loading strategy for external scripts: async (default), defer, blocking */
    loading_strategy: ScriptLoadingStrategy;
    /** Toggle on/off without deleting */
    enabled: boolean;
}
export interface IB2CStorefrontMetaTags {
    title?: string;
    description?: string;
    keywords?: string;
    author?: string;
    robots?: string;
    canonical_url?: string;
    og_title?: string;
    og_description?: string;
    og_image?: string;
    og_site_name?: string;
    og_type?: string;
    twitter_card?: string;
    twitter_site?: string;
    twitter_creator?: string;
    twitter_image?: string;
    theme_color?: string;
    google_site_verification?: string;
    bing_site_verification?: string;
    structured_data?: string;
}
export interface IB2BPortalSeoConfig {
    /**
     * Category URL root segment. `default` falls back to "categorie".
     * Optional per-locale overrides (e.g. { it: "prodotti", en: "products" }).
     */
    category_root?: {
        default?: string;
        [locale: string]: string | undefined;
    };
    robots?: {
        /** When true the storefront emits `Disallow: /` (de-index the whole site). */
        noindex?: boolean;
        allow?: string[];
        disallow?: string[];
    };
}
//# sourceMappingURL=types.d.ts.map