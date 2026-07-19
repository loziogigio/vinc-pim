import { type JSX } from "react";
/**
 * Pages management screen (custom B2C pages list).
 *
 * Chrome-less: the host renders breadcrumbs around this component. Extracted from
 * CS `app/b2b/(protected)/b2c/storefronts/[slug]/pages/page.tsx`.
 *
 * @param storefrontLabel Optional storefront name shown in the subtitle where CS
 *   used the storefront slug. Omit it and the subtitle renders the count only.
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function PagesListScreen({ storefrontLabel }?: {
    storefrontLabel?: string;
}): JSX.Element;
//# sourceMappingURL=PagesListScreen.d.ts.map