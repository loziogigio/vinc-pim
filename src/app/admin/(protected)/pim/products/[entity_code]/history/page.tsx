"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  GitBranch,
  Calendar,
  User,
} from "lucide-react";

type ProductVersion = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string;
  description?: string;
  version: number;
  isCurrent: boolean;
  isCurrentPublished: boolean;
  status: "draft" | "published" | "archived";
  published_at?: string;
  image: { id: string; thumbnail: string; original: string };
  brand?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };
  completeness_score: number;
  critical_issues: string[];
  source: {
    source_id: string;
    source_name: string;
    imported_at: string;
  };
  manually_edited: boolean;
  edited_by?: string;
  edited_at?: string;
  created_at: string;
  updated_at: string;
};

export default function ProductHistoryPage({
  params,
}: {
  params: Promise<{ entity_code: string }>;
}) {
  const { entity_code } = use(params);
  const router = useRouter();
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  useEffect(() => {
    fetchVersions();
  }, [entity_code]);

  async function fetchVersions() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/pim/products/${entity_code}/history`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      } else if (res.status === 404) {
        router.push("/admin/pim/products");
      }
    } catch (error) {
      console.error("Error fetching product history:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "published":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case "draft":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "archived":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "published":
        return "bg-emerald-100 text-emerald-700";
      case "draft":
        return "bg-amber-100 text-amber-700";
      case "archived":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  const currentProduct = versions.find((v) => v.isCurrent);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/admin/pim" },
          { label: "Products", href: "/admin/pim/products" },
          {
            label: currentProduct?.name || entity_code,
            href: `/admin/pim/products/${entity_code}`,
          },
          { label: "Version History" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/pim/products/${entity_code}`}
            className="p-2 rounded border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Version History</h1>
            <p className="text-sm text-muted-foreground">
              {currentProduct?.name} • {versions.length} version{versions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Current Product Info */}
      {currentProduct && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded overflow-hidden bg-white flex-shrink-0">
              {currentProduct.image?.thumbnail && (
                <Image
                  src={currentProduct.image.thumbnail}
                  alt={currentProduct.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{currentProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    SKU: {currentProduct.sku} • Version {currentProduct.version}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    currentProduct.status
                  )}`}
                >
                  Current
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version Timeline */}
      <div className="rounded-lg bg-card shadow-sm border border-border">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Version Timeline
          </h2>
        </div>

        <div className="divide-y divide-border">
          {versions.map((version, index) => (
            <div
              key={version._id}
              className={`p-4 hover:bg-muted/30 transition ${
                version.isCurrent ? "bg-blue-50/50" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Version Badge */}
                <div className="flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      version.isCurrent
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    v{version.version}
                  </div>
                </div>

                {/* Product Thumbnail */}
                <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                  {version.image?.thumbnail && (
                    <Image
                      src={version.image.thumbnail}
                      alt={version.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Version Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{version.name}</h3>
                      <p className="text-xs text-muted-foreground">{version.sku}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {version.isCurrent && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          Current
                        </span>
                      )}
                      {version.isCurrentPublished && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          Published
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          version.status
                        )}`}
                      >
                        {version.status}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatTimeAgo(version.created_at)}</span>
                    </div>
                    {version.manually_edited && version.edited_by && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>Edited by {version.edited_by}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span>Source: {version.source.source_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Quality: {version.completeness_score}%</span>
                    </div>
                  </div>

                  {/* Description Preview */}
                  {version.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {version.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/pim/products/${entity_code}?version=${version.version}`}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded border border-border hover:bg-muted text-sm"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Link>
                  </div>
                </div>
              </div>

              {/* Connection Line */}
              {index < versions.length - 1 && (
                <div className="ml-5 mt-2 mb-2 h-4 border-l-2 border-dashed border-border"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
