"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { CmsAdminProvider, HomeBuilderScreen } from "vinc-cms-admin/react";
import { useCsCmsAdapter } from "@/lib/cms-admin/cs-adapter";

export const dynamic = "force-dynamic";

function B2CHomeBuilderContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  const storefrontSlug = searchParams.get("storefront");
  const urlVersion = searchParams.get("v");
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const adapter = useCsCmsAdapter(storefrontSlug || "", tenantPrefix);

  if (!storefrontSlug) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center">
          <p className="text-[#5e5873] font-medium">No storefront selected</p>
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
      <HomeBuilderScreen
        initialVersion={urlVersion ? Number(urlVersion) : undefined}
        storefrontLabel={storefrontSlug}
      />
    </CmsAdminProvider>
  );
}

export default function B2CHomeBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <B2CHomeBuilderContent />
    </Suspense>
  );
}
