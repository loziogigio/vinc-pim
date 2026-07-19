import { type JSX } from "react";
/**
 * Custom B2C page builder screen. Extracted from CS
 * `app/b2b/(builder)/b2c-page-builder/page.tsx`.
 *
 * The host owns Suspense and guarantees a non-empty `pageSlug` (the missing-param
 * guard lived in the CS page and now lives in the host wrapper).
 *
 * @param storefrontLabel Optional storefront name shown in the toolbar badge where
 *   CS used the storefront slug. Omit it and the badge renders empty.
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function PageBuilderScreen({ pageSlug, allowedBlockIds, storefrontLabel, }: {
    pageSlug: string;
    allowedBlockIds?: readonly string[];
    storefrontLabel?: string;
}): JSX.Element | null;
//# sourceMappingURL=PageBuilderScreen.d.ts.map