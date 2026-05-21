import { DEFAULT_CHANNEL } from "@/lib/constants/channel";
import type { BlogChannelContext } from "./types";

/** Resolve a B2C storefront record into a blog channel context. */
export function resolveB2CBlogContext(storefront: {
  slug: string;
  name?: string;
  channel?: string;
}): BlogChannelContext {
  return {
    channel: storefront.channel || DEFAULT_CHANNEL,
    label: storefront.name || storefront.slug,
    basePath: `/b2b/b2c/storefronts/${storefront.slug}/blog`,
  };
}
