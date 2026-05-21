"use client";

import { DEFAULT_CHANNEL } from "@/lib/constants/channel";
import { BlogListView } from "@/components/blog/BlogListView";

export default function B2BBlogPage() {
  return (
    <BlogListView context={{ channel: DEFAULT_CHANNEL, label: DEFAULT_CHANNEL, basePath: "/b2b/blog" }} />
  );
}
