"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogScreen = BlogScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const BlogListView_js_1 = require("../blog/BlogListView.js");
/**
 * Blog posts screen: thin shell over BlogListView, mirroring CS's B2C storefront blog
 * page (`app/b2b/(protected)/b2c/storefronts/[slug]/blog/page.tsx`), which composes just
 * `<BlogListView />` (post categories/tags are assigned from BlogListView's own settings
 * modal). Taxonomy *management* (create/edit categories & tags) is a separate host route
 * that mounts `BlogTaxonomyManager`, matching CS's tenant-level pages — it is intentionally
 * not part of this screen.
 *
 * CS's `context: BlogChannelContext` (channel + label + basePath) collapses to the
 * adapter: the storefront IS the channel (forced server-side), `storefrontLabel` supplies
 * the subtitle label, and the builder link comes from `links.blogBuilder`.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function BlogScreen({ storefrontLabel }) {
    return (0, jsx_runtime_1.jsx)(BlogListView_js_1.BlogListView, { storefrontLabel: storefrontLabel });
}
//# sourceMappingURL=BlogScreen.js.map