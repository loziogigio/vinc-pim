import { type JSX } from "react";
/**
 * Blog categories/tags manager (list + create/edit/delete modal). Extracted from CS
 * `components/blog/BlogTaxonomyManager.tsx`.
 *
 * Transforms: `useTranslation` -> `useCmsAdmin().t`; `useLanguageStore` -> `adapter.locales`
 * (first entry = default language, used to key the name map); `blog-api.ts` fetchers ->
 * client methods (`listBlogCategories`/`createBlogCategory`/`updateBlogCategory`/… and the
 * tag equivalents). Update uses the wrapper's PUT verb (CS used PATCH on its tenant route).
 * The create/update body never carries `channels` (server forces the storefront channel).
 *
 * Exported for hosts that mount taxonomy management on their own route (mirroring CS's
 * tenant-level `/b2b/blog/categories` + `/b2b/blog/tags` pages); it is not part of BlogScreen.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function BlogTaxonomyManager({ kind }: {
    kind: "categories" | "tags";
}): JSX.Element;
//# sourceMappingURL=BlogTaxonomyManager.d.ts.map