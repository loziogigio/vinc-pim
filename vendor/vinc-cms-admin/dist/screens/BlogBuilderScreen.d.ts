import { type JSX } from "react";
/**
 * Blog-post content builder. Extracted from CS `app/b2b/(builder)/blog-builder/page.tsx`.
 *
 * Transforms from the CS original:
 *  - CS's Suspense wrapper + `useSearchParams` (`?post`, `?locale`, `?back`) move to the
 *    HOST: `postId` and `locale` are now props. The screen asserts both early (return null);
 *    the host owns the "missing params" screen and Suspense.
 *  - `useLanguageStore` + the in-place language `<select>` are DROPPED. `locale` is a
 *    host-controlled prop shown as a static badge; hosts switch languages by linking to
 *    `links.blogBuilder(postId, code)` (the same link BlogListView's Edit-content uses).
 *  - The save/publish/load fetch table -> client methods (`getBlogContent`, `saveBlogDraft`,
 *    `publishBlogContent`), each carrying `?locale=` (handled inside the client).
 *  - LivePreview: CS passed `pageType="home" pageSlug={postId}`; preserved via
 *    `previewUrl({ pageSlug: postId })` (adapter), like the other builders.
 *  - Back-link target -> `links.blogList ?? links.dashboard` (dedicated blog-list link when
 *    the host provides one, else the generic dashboard). `useTranslation` -> `useCmsAdmin().t`.
 *  - `BLOG_BLOCKS` is the default `allowedBlockIds` (now a shared registry export).
 *  - Colors are kept verbatim from the CS builder page.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function BlogBuilderScreen({ postId, locale, allowedBlockIds, }: {
    postId: string;
    locale: string;
    allowedBlockIds?: readonly string[];
}): JSX.Element | null;
//# sourceMappingURL=BlogBuilderScreen.d.ts.map