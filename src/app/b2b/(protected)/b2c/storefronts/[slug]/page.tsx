"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Save, Pencil, ExternalLink } from "lucide-react";

interface Storefront {
  _id: string;
  name: string;
  slug: string;
  domains: string[];
  status: "active" | "inactive";
  settings: {
    default_language?: string;
    theme?: string;
  };
  created_at: string;
  updated_at: string;
}

export default function StorefrontDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname() || "";
  const router = useRouter();
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editable fields
  const [name, setName] = useState("");
  const [domainsInput, setDomainsInput] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [defaultLanguage, setDefaultLanguage] = useState("");

  useEffect(() => {
    fetch(`/api/b2b/b2c/storefronts/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          const sf = data.data as Storefront;
          setStorefront(sf);
          setName(sf.name);
          setDomainsInput(sf.domains.join(", "));
          setStatus(sf.status);
          setDefaultLanguage(sf.settings?.default_language || "");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const domains = domainsInput
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domains,
          status,
          settings: { default_language: defaultLanguage || undefined },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        return;
      }

      setStorefront(data.data);
      setSuccess("Storefront updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#009688] border-t-transparent" />
      </div>
    );
  }

  if (!storefront) {
    return (
      <div className="p-6">
        <p className="text-[#b9b9c3]">Storefront not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`${tenantPrefix}/b2b/b2c/storefronts`}
          className="rounded-md p-1 text-[#b9b9c3] hover:text-[#5e5873] hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-[#5e5873]">
            {storefront.name}
          </h1>
          <p className="text-sm text-[#b9b9c3]">
            Slug: {storefront.slug}
          </p>
        </div>
        <Link
          href={`${tenantPrefix}/b2b/b2c-home-builder?storefront=${slug}`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
        >
          <Pencil className="h-4 w-4" />
          Open Builder
        </Link>
      </div>

      {/* Form */}
      <div className="rounded-lg border border-[#ebe9f1] bg-white p-6 max-w-2xl">
        <h2 className="font-semibold text-[#5e5873] mb-4">
          Storefront Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1">
              Domains (comma-separated)
            </label>
            <input
              type="text"
              value={domainsInput}
              onChange={(e) => setDomainsInput(e.target.value)}
              placeholder="shop.example.com, www.example.com"
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[#b9b9c3]">
              These domains are used to identify which storefront a B2C frontend
              belongs to via the Origin header.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "inactive")
              }
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1">
              Default Language
            </label>
            <input
              type="text"
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              placeholder="it"
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
