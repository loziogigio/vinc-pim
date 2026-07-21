"use strict";
// Copied from vinc-commerce-suite src/components/blog/types.ts, with BlogPostStatus /
// BLOG_POST_STATUSES copied in from src/lib/constants/blog.ts (verbatim).
//
// Dropped from the CS version (the package list view has no channel picker — the
// storefront IS the channel, forced server-side): `BlogChannelContext` and
// `SalesChannelOption`. `BlogPostListItem.channels` is kept because the server still
// returns it; only the channel column/picker UI is removed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOG_POST_STATUSES = void 0;
exports.BLOG_POST_STATUSES = ["draft", "scheduled", "published"];
//# sourceMappingURL=types.js.map