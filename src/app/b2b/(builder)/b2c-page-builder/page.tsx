"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { CmsAdminProvider, PageBuilderScreen } from "vinc-cms-admin/react";
import { useCsCmsAdapter } from "@/lib/cms-admin/cs-adapter";

export const dynamic = "force-dynamic";

function B2CPageBuilderContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  const storefrontSlug = searchParams.get("storefront");
  const pageSlug = searchParams.get("page");
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const adapter = useCsCmsAdapter(storefrontSlug || "", tenantPrefix);

  if (!storefrontSlug || !pageSlug) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center">
          <p className="text-[#5e5873] font-medium">
            Missing storefront or page parameter
          </p>
          <Link
            href={`${tenantPrefix}/b2b/b2c`}
            className="mt-2 inline-block text-sm text-[#009688] hover:underline"
          >
            Back to B2C Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CmsAdminProvider adapter={adapter}>
      <PageBuilderScreen pageSlug={pageSlug} storefrontLabel={storefrontSlug} />
    </CmsAdminProvider>
  );
}

export default function B2CPageBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <B2CPageBuilderContent />
    </Suspense>
  );
}
