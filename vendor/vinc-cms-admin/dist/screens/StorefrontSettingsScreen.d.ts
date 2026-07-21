import { type JSX } from "react";
export type SettingsSectionId = "seo" | "scripts" | "css" | "sitemap";
/**
 * Storefront settings screen (SEO / Scripts / CSS / Sitemap).
 *
 * Chrome-less: the host renders breadcrumbs/page title and owns the active-section
 * state via `section`/`onSectionChange`. Mirrors CS
 * `app/b2b/(protected)/b2c/storefronts/[slug]/page.tsx`'s metaTags/customScripts/
 * customCss seeding and save handlers.
 *
 * The Save button in every section PATCHes ONLY `{ meta_tags, custom_scripts,
 * custom_css }` — never `name`/`channel`/`domains` (office security contract).
 * A failed save never discards the in-progress edit; it only surfaces the
 * `CmsAdminError` message in the error banner.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function StorefrontSettingsScreen({ section, onSectionChange, storefrontLabel, }: {
    section: SettingsSectionId;
    onSectionChange?: (section: SettingsSectionId) => void;
    storefrontLabel?: string;
}): JSX.Element;
//# sourceMappingURL=StorefrontSettingsScreen.d.ts.map