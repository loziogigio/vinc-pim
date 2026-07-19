import { type JSX } from "react";
/**
 * B2C home page builder screen (versioned). Extracted from CS
 * `app/b2b/(builder)/b2c-home-builder/page.tsx`.
 *
 * The host owns Suspense and guarantees the storefront context (the CS
 * no-storefront guard now lives host-side). `initialVersion` replaces the CS
 * `?v=` search param; the `window.history.replaceState` `?v=` URL sync is kept.
 *
 * @param storefrontLabel Optional storefront name shown in the toolbar badge where
 *   CS used the storefront slug. Omit it and the badge renders empty.
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function HomeBuilderScreen({ initialVersion, allowedBlockIds, storefrontLabel, }: {
    initialVersion?: number;
    allowedBlockIds?: readonly string[];
    storefrontLabel?: string;
}): JSX.Element;
//# sourceMappingURL=HomeBuilderScreen.d.ts.map