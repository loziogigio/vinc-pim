import type { JSX } from "react";
export type FormsTab = "submissions" | "definitions";
/**
 * Forms screen: thin tab shell over the submissions inbox and form-definitions list.
 *
 * Chrome-less except for the tab bar itself, which this screen owns (mirroring CS
 * `app/b2b/(protected)/b2c/storefronts/[slug]/forms/page.tsx`'s tab bar) — the host
 * still renders breadcrumbs/page title and owns the active-tab state via `tab`/
 * `onTabChange`.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function FormsScreen({ tab, onTabChange, storefrontLabel, }: {
    tab: FormsTab;
    onTabChange?: (tab: FormsTab) => void;
    storefrontLabel?: string;
}): JSX.Element;
//# sourceMappingURL=FormsScreen.d.ts.map