"use client";

import { use, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BlogListView } from "@/components/blog/BlogListView";
import { resolveB2CBlogContext } from "@/components/blog/context";
import type { BlogChannelContext } from "@/components/blog/types";

export default function StorefrontBlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [context, setContext] = useState<BlogChannelContext | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/b2b/b2c/storefronts/${slug}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const sf = json?.data || {};
        if (active) setContext(resolveB2CBlogContext({ slug, name: sf.name, channel: sf.channel }));
      })
      .catch(() => { if (active) setContext(resolveB2CBlogContext({ slug })); });
    return () => { active = false; };
  }, [slug]);

  if (!context) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#009688]" /></div>;
  }
  return <BlogListView context={context} />;
}
