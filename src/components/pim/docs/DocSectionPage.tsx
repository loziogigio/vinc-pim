"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ExternalLink, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { DOC_SECTIONS, type DocSectionDef } from "@/components/pim/PIMDocumentation";

/** Map section slug → translation content keys */
const SECTION_CONTENT: Record<string, string[]> = {
  overview: [
    "pages.pim.documentation.overviewDetails",
    "pages.pim.documentation.overviewActions",
  ],
  products: [
    "pages.pim.documentation.productsColumns",
    "pages.pim.documentation.productsActions",
    "pages.pim.documentation.productsSorting",
    "pages.pim.documentation.productsDetail",
    "pages.pim.documentation.productsVersioning",
  ],
  categories: [
    "pages.pim.documentation.categoriesFeatures",
    "pages.pim.documentation.categoriesActions",
    "pages.pim.documentation.categoriesSeo",
  ],
  collections: [
    "pages.pim.documentation.collectionsFeatures",
    "pages.pim.documentation.collectionsActions",
  ],
  brands: [
    "pages.pim.documentation.brandsFeatures",
    "pages.pim.documentation.brandsActions",
  ],
  tags: [
    "pages.pim.documentation.tagsFeatures",
    "pages.pim.documentation.tagsActions",
  ],
  "product-types": [
    "pages.pim.documentation.productTypesFeatures",
    "pages.pim.documentation.productTypesActions",
  ],
  "tech-specs": [
    "pages.pim.documentation.techSpecsFeatures",
    "pages.pim.documentation.techSpecsActions",
  ],
  synonyms: [
    "pages.pim.documentation.synonymsFeatures",
    "pages.pim.documentation.synonymsActions",
  ],
  "menu-settings": ["pages.pim.documentation.menuSettingsFeatures"],
  languages: ["pages.pim.documentation.languagesFeatures"],
  import: ["pages.pim.documentation.importFeatures"],
  jobs: ["pages.pim.documentation.jobsFeatures"],
  "batch-sync": [
    "pages.pim.documentation.batchSyncFeatures",
    "pages.pim.documentation.batchSyncStats",
  ],
  sources: ["pages.pim.documentation.sourcesFeatures"],
};

/** Search Filters sub-sections */
const SEARCH_SUB_SECTIONS = [
  { titleKey: "pages.pim.documentation.searchBasicTitle", descKey: "pages.pim.documentation.searchBasicDesc" },
  { titleKey: "pages.pim.documentation.searchFiltersTitle", descKey: "pages.pim.documentation.searchFiltersDesc" },
  {
    titleKey: "pages.pim.documentation.searchAdvancedTitle",
    descKey: "pages.pim.documentation.searchAdvancedDesc",
    items: [
      "pages.pim.documentation.searchAdvancedBatch",
      "pages.pim.documentation.searchAdvancedEntityCode",
      "pages.pim.documentation.searchAdvancedSku",
      "pages.pim.documentation.searchAdvancedParentSku",
      "pages.pim.documentation.searchAdvancedBrand",
      "pages.pim.documentation.searchAdvancedCategory",
      "pages.pim.documentation.searchAdvancedProductType",
      "pages.pim.documentation.searchAdvancedPrice",
      "pages.pim.documentation.searchAdvancedScore",
    ],
  },
  { titleKey: "pages.pim.documentation.searchBulkTitle", descKey: "pages.pim.documentation.searchBulkDesc" },
];

/** API Reference subsections */
const API_SUBSECTIONS = {
  endpoints: [
    { method: "GET", path: "/api/b2b/pim/products", key: "pages.pim.documentation.apiGetProducts" },
    { method: "GET", path: "/api/b2b/pim/products/:entity_code", key: "pages.pim.documentation.apiGetProduct" },
    { method: "POST", path: "/api/b2b/pim/products", key: "pages.pim.documentation.apiCreateProduct" },
    { method: "PATCH", path: "/api/b2b/pim/products/:entity_code", key: "pages.pim.documentation.apiUpdateProduct" },
    { method: "DELETE", path: "/api/b2b/pim/products/:entity_code", key: "pages.pim.documentation.apiDeleteProduct" },
    { method: "POST", path: ".../:entity_code/publish", key: "pages.pim.documentation.apiPublishProduct" },
    { method: "POST", path: ".../:entity_code/unpublish", key: "pages.pim.documentation.apiUnpublishProduct" },
    { method: "POST", path: ".../products/bulk-publish", key: "pages.pim.documentation.apiBulkPublish" },
    { method: "POST", path: ".../products/bulk-update", key: "pages.pim.documentation.apiBulkUpdate" },
    { method: "POST", path: ".../products/export", key: "pages.pim.documentation.apiExport" },
  ],
  filterParams: [
    { param: "page", key: "pages.pim.documentation.apiFilterPage" },
    { param: "limit", key: "pages.pim.documentation.apiFilterLimit" },
    { param: "search", key: "pages.pim.documentation.apiFilterSearch" },
    { param: "status", key: "pages.pim.documentation.apiFilterStatus" },
    { param: "product_kind", key: "pages.pim.documentation.apiFilterProductKind" },
    { param: "sort", key: "pages.pim.documentation.apiFilterSort" },
    { param: "brand", key: "pages.pim.documentation.apiFilterBrand" },
    { param: "category", key: "pages.pim.documentation.apiFilterCategory" },
    { param: "product_type", key: "pages.pim.documentation.apiFilterProductType" },
    { param: "sku", key: "pages.pim.documentation.apiFilterSku" },
    { param: "sku_match", key: "pages.pim.documentation.apiFilterSkuMatch" },
    { param: "price_min", key: "pages.pim.documentation.apiFilterPriceMin" },
    { param: "price_max", key: "pages.pim.documentation.apiFilterPriceMax" },
    { param: "score_min", key: "pages.pim.documentation.apiFilterScoreMin" },
    { param: "score_max", key: "pages.pim.documentation.apiFilterScoreMax" },
  ],
  updateGroups: [
    "pages.pim.documentation.apiUpdateBasic",
    "pages.pim.documentation.apiUpdateAssoc",
    "pages.pim.documentation.apiUpdateAttrs",
    "pages.pim.documentation.apiUpdatePricing",
    "pages.pim.documentation.apiUpdateMedia",
    "pages.pim.documentation.apiUpdateChannels",
  ],
  otherEndpoints: [
    "pages.pim.documentation.apiOtherBrands",
    "pages.pim.documentation.apiOtherCategories",
    "pages.pim.documentation.apiOtherCollections",
    "pages.pim.documentation.apiOtherTags",
    "pages.pim.documentation.apiOtherProductTypes",
    "pages.pim.documentation.apiOtherTechSpecs",
    "pages.pim.documentation.apiOtherSynonyms",
    "pages.pim.documentation.apiOtherJobs",
    "pages.pim.documentation.apiOtherImages",
    "pages.pim.documentation.apiOtherMedia",
    "pages.pim.documentation.apiOtherHistory",
    "pages.pim.documentation.apiOtherAssoc",
  ],
};

function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="rounded-[0.358rem] border border-[#ebe9f1] bg-[#f8f8f8] overflow-hidden">
      {title && (
        <div className="border-b border-[#ebe9f1] bg-[#f0f0f3] px-4 py-2 text-xs font-semibold text-[#5e5873]">{title}</div>
      )}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-[#6e6b7b]"><code>{code}</code></pre>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const c: Record<string, string> = {
    GET: "bg-[#28c76f1a] text-[#28c76f]",
    POST: "bg-[#ff9f431a] text-[#ff9f43]",
    PATCH: "bg-[#00cfe81a] text-[#00cfe8]",
    DELETE: "bg-[#ea54551a] text-[#ea5455]",
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${c[method] || "bg-gray-100 text-gray-600"}`}>{method}</span>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#6e6b7b]">
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#009688]" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

export function DocSectionPage({ section: sectionSlug }: { section: string }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const sectionDef = DOC_SECTIONS.find((s) => s.slug === sectionSlug);
  if (!sectionDef) {
    return (
      <div className="text-center py-20 text-[#6e6b7b]">
        <p className="text-lg font-semibold">Section not found</p>
        <Link href={`${tenantPrefix}/b2b/pim/documentation`} className="mt-4 inline-flex items-center gap-1 text-sm text-[#009688] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
    );
  }

  const Icon = sectionDef.icon;
  const isSearchFilters = sectionSlug === "search-filters";
  const isApiRef = sectionSlug === "api-reference";
  const contentKeys = SECTION_CONTENT[sectionSlug] || [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`${tenantPrefix}/b2b/pim/documentation`}
        className="inline-flex items-center gap-1 text-sm text-[#009688] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("pages.pim.documentation.toc")}
      </Link>

      {/* Section card */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        {/* Title */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[0.358rem] bg-[rgba(0,150,136,0.12)]">
            <Icon className="h-5 w-5 text-[#009688]" />
          </div>
          <h1 className="text-lg font-semibold text-[#5e5873]">{t(sectionDef.titleKey)}</h1>
          {sectionDef.pimHref && (
            <Link
              href={`${tenantPrefix}${sectionDef.pimHref}`}
              className="ml-auto flex items-center gap-1 rounded-[0.358rem] border border-[#ebe9f1] px-3 py-1.5 text-xs font-medium text-[#009688] transition hover:bg-[rgba(0,150,136,0.08)]"
            >
              {t("pages.pim.documentation.goToSection")}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Description */}
        <p className="mb-4 text-sm leading-relaxed text-[#6e6b7b]">{t(sectionDef.descKey)}</p>

        {/* Standard content paragraphs */}
        {!isSearchFilters && !isApiRef && contentKeys.map((key) => (
          <p key={key} className="mb-3 text-sm leading-relaxed text-[#6e6b7b]">{t(key)}</p>
        ))}

        {/* Search Filters: custom layout */}
        {isSearchFilters && (
          <div className="space-y-5">
            {SEARCH_SUB_SECTIONS.map((sub) => (
              <div key={sub.titleKey}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5e5873]">
                  <ChevronRight className="h-4 w-4 text-[#009688]" />
                  {t(sub.titleKey)}
                </h3>
                <p className="mb-2 pl-6 text-sm leading-relaxed text-[#6e6b7b]">{t(sub.descKey)}</p>
                {sub.items && (
                  <ul className="space-y-1.5 pl-6">
                    {sub.items.map((k) => <Bullet key={k}>{t(k)}</Bullet>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* API Reference: tables + code blocks */}
        {isApiRef && <ApiReferenceContent t={t} />}
      </div>
    </div>
  );
}

/** API Reference content (extracted to keep main component lean) */
function ApiReferenceContent({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-8">
      {/* Auth */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5e5873]">{t("pages.pim.documentation.apiAuthTitle")}</h3>
        <ul className="space-y-1.5"><Bullet>{t("pages.pim.documentation.apiAuthSession")}</Bullet><Bullet>{t("pages.pim.documentation.apiAuthApiKey")}</Bullet></ul>
        <div className="mt-3"><CodeBlock title="API Key Headers" code={`x-auth-method: api-key\nx-api-key-id: YOUR_KEY_ID\nx-api-key-secret: YOUR_SECRET`} /></div>
      </div>

      {/* Endpoints table */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5e5873]">{t("pages.pim.documentation.apiEndpointsTitle")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#ebe9f1]"><th className="px-3 py-2 text-left text-xs font-semibold text-[#5e5873]">Method</th><th className="px-3 py-2 text-left text-xs font-semibold text-[#5e5873]">Endpoint</th><th className="px-3 py-2 text-left text-xs font-semibold text-[#5e5873]">Description</th></tr></thead>
            <tbody>
              {API_SUBSECTIONS.endpoints.map((ep) => (
                <tr key={`${ep.method}-${ep.path}`} className="border-b border-[#ebe9f1] last:border-0">
                  <td className="px-3 py-2"><MethodBadge method={ep.method} /></td>
                  <td className="px-3 py-2 font-mono text-xs text-[#5e5873]">{ep.path}</td>
                  <td className="px-3 py-2 text-[#6e6b7b]">{t(ep.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter params */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5e5873]">{t("pages.pim.documentation.apiFiltersTitle")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#ebe9f1]"><th className="px-3 py-2 text-left text-xs font-semibold text-[#5e5873]">Parameter</th><th className="px-3 py-2 text-left text-xs font-semibold text-[#5e5873]">Description</th></tr></thead>
            <tbody>
              {API_SUBSECTIONS.filterParams.map((fp) => (
                <tr key={fp.param} className="border-b border-[#ebe9f1] last:border-0">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-[#009688]">{fp.param}</td>
                  <td className="px-3 py-2 text-[#6e6b7b]">{t(fp.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Updatable fields */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5e5873]">{t("pages.pim.documentation.apiUpdateTitle")}</h3>
        <p className="mb-2 text-sm text-[#6e6b7b]">{t("pages.pim.documentation.apiUpdateDesc")}</p>
        <ul className="space-y-1.5">{API_SUBSECTIONS.updateGroups.map((k) => <Bullet key={k}>{t(k)}</Bullet>)}</ul>
      </div>

      {/* Other endpoints */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5e5873]">{t("pages.pim.documentation.apiOtherTitle")}</h3>
        <ul className="space-y-1.5">{API_SUBSECTIONS.otherEndpoints.map((k) => <Bullet key={k}><span className="font-mono text-xs">{t(k)}</span></Bullet>)}</ul>
      </div>

      {/* Response format */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5e5873]">{t("pages.pim.documentation.apiResponseTitle")}</h3>
        <p className="mb-3 text-sm text-[#6e6b7b]">{t("pages.pim.documentation.apiResponseDesc")}</p>
        <CodeBlock title="Success / Error" code={`// List\n{ "products": [...], "pagination": { "page": 1, "limit": 50, "total": 100, "pages": 2 } }\n\n// Single\n{ "product": { ... } }\n\n// Error\n{ "error": "Message" }  // 400 | 401 | 404 | 409`} />
      </div>
    </div>
  );
}
