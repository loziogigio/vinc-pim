"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Store, Plus, ExternalLink } from "lucide-react";

interface Storefront {
  _id: string;
  name: string;
  slug: string;
  domains: string[];
  status: "active" | "inactive";
  created_at: string;
}

export default function B2CDashboardPage() {
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/b2b/b2c/storefronts?limit=50")
      .then((res) => res.json())
      .then((data) => {
        setStorefronts(data.items || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">B2C Storefront</h1>
          <p className="text-sm text-[#b9b9c3] mt-1">
            Manage your web storefronts and their homepage builders
          </p>
        </div>
        <Link
          href={`${tenantPrefix}/b2b/b2c/storefronts`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Manage Storefronts
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#009688] border-t-transparent" />
        </div>
      ) : storefronts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#ebe9f1] bg-white p-12 text-center">
          <Globe className="mx-auto h-12 w-12 text-[#b9b9c3]" />
          <h3 className="mt-4 text-lg font-medium text-[#5e5873]">
            No storefronts yet
          </h3>
          <p className="mt-2 text-sm text-[#b9b9c3]">
            Create your first B2C storefront to start building its homepage.
          </p>
          <Link
            href={`${tenantPrefix}/b2b/b2c/storefronts`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Storefront
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {storefronts.map((sf) => (
            <div
              key={sf._id}
              className="rounded-lg border border-[#ebe9f1] bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100">
                    <Store className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#5e5873]">{sf.name}</h3>
                    <p className="text-xs text-[#b9b9c3]">{sf.slug}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    sf.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {sf.status}
                </span>
              </div>

              {sf.domains.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {sf.domains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-[#5e5873]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {d}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Link
                  href={`${tenantPrefix}/b2b/b2c-home-builder?storefront=${sf.slug}`}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-[#009688] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00796b] transition-colors"
                >
                  Open Builder
                </Link>
                <Link
                  href={`${tenantPrefix}/b2b/b2c/storefronts/${sf.slug}`}
                  className="inline-flex items-center justify-center rounded-md border border-[#ebe9f1] px-3 py-1.5 text-xs font-medium text-[#5e5873] hover:bg-gray-50 transition-colors"
                >
                  Settings
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
