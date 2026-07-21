export declare function SitemapSection({ storefrontSlug, apiBasePath, robotsManagedInSeo, }: {
    storefrontSlug: string;
    /**
     * Base path for the sitemap API. Defaults to the B2C storefront route.
     * Pass a B2B portal route (e.g. `/api/b2b/b2b/portals/${slug}/sitemap`) to
     * reuse this component on the B2B portal detail page. All fetches (GET, the
     * POST actions) are built off this base.
     */
    apiBasePath?: string;
    /** B2B portals keep their authoritative robots rules in portal.seo_config. */
    robotsManagedInSeo?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=sitemap-section.d.ts.map