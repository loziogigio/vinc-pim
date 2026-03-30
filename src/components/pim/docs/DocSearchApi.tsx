"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Globe, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  const c: Record<string, string> = { GET: "bg-[#28c76f1a] text-[#28c76f]", POST: "bg-[#ff9f431a] text-[#ff9f43]" };
  return <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${c[method] || "bg-gray-100"}`}>{method}</span>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#5e5873]"><ChevronRight className="h-4 w-4 text-[#009688]" />{children}</h3>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#6e6b7b]">
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#009688]" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function ParamRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-[#ebe9f1] last:border-0">
      <td className="px-3 py-2 font-mono text-xs font-semibold text-[#009688] whitespace-nowrap">{name}</td>
      <td className="px-3 py-2 text-sm text-[#6e6b7b]">{children}</td>
    </tr>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#ebe9f1]">
            {headers.map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-[#5e5873]">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const STANDARD_FILTERS = [
  { key: "category_id", tk: "searchApiStdCategoryId" },
  { key: "category_ancestors", tk: "searchApiStdCategoryAnc" },
  { key: "brand_id", tk: "searchApiStdBrandId" },
  { key: "brand_ancestors", tk: "searchApiStdBrandAnc" },
  { key: "product_type_id", tk: "searchApiStdProductTypeId" },
  { key: "product_type_code", tk: "searchApiStdProductTypeCode" },
  { key: "product_type_ancestors", tk: "searchApiStdProductTypeAnc" },
  { key: "collection_ids", tk: "searchApiStdCollectionIds" },
  { key: "collection_ancestors", tk: "searchApiStdCollectionAnc" },
  { key: "stock_status", tk: "searchApiStdStockStatus" },
  { key: "status", tk: "searchApiStdStatus" },
  { key: "has_active_promo", tk: "searchApiStdHasPromo" },
  { key: "channels", tk: "searchApiStdChannels" },
  { key: "tag_groups", tk: "searchApiStdTagGroups" },
  { key: "tag_categories", tk: "searchApiStdTagCategories" },
  { key: "promo_codes", tk: "searchApiStdPromoCodes" },
  { key: "price_min / price_max", tk: "searchApiStdPriceMin" },
  { key: "sku", tk: "searchApiStdSku" },
  { key: "ean", tk: "searchApiStdEan" },
  { key: "entity_code", tk: "searchApiStdEntityCode" },
  { key: "parent_sku", tk: "searchApiStdParentSku" },
  { key: "parent_entity_code", tk: "searchApiStdParentEntityCode" },
  { key: "is_parent", tk: "searchApiStdIsParent" },
];

const BODY_PARAMS = [
  { key: "text", tk: "searchApiBodyText" },
  { key: "lang", tk: "searchApiBodyLang" },
  { key: "channel", tk: "searchApiBodyChannel" },
  { key: "start", tk: "searchApiBodyStart" },
  { key: "rows", tk: "searchApiBodyRows" },
  { key: "filters", tk: "searchApiBodyFilters" },
  { key: "sort", tk: "searchApiBodySort" },
  { key: "fuzzy", tk: "searchApiBodyFuzzy" },
  { key: "fuzzy_num", tk: "searchApiBodyFuzzyNum" },
  { key: "include_faceting", tk: "searchApiBodyFaceting" },
  { key: "group_variants", tk: "searchApiBodyGroupVariants" },
  { key: "facet_fields", tk: "searchApiBodyFacetFields" },
  { key: "customer_code", tk: "searchApiBodyCustomer" },
  { key: "address_code", tk: "searchApiBodyAddress" },
  { key: "tag_filter", tk: "searchApiBodyTagFilter" },
];

const SORT_OPTIONS = [
  "searchApiSortRelevance",
  "searchApiSortNewest",
  "searchApiSortPrice",
  "searchApiSortPopularity",
  "searchApiSortName",
  "searchApiSortPriority",
];

export function DocSearchApi() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const tk = (key: string) => t(`pages.pim.documentation.${key}`);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href={`${tenantPrefix}/b2b/pim/documentation`} className="inline-flex items-center gap-1 text-sm text-[#009688] hover:underline">
        <ArrowLeft className="h-4 w-4" />{t("pages.pim.documentation.toc")}
      </Link>

      {/* Header */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[0.358rem] bg-[rgba(0,150,136,0.12)]">
            <Globe className="h-5 w-5 text-[#009688]" />
          </div>
          <h1 className="text-lg font-semibold text-[#5e5873]">{tk("searchApiTitle")}</h1>
        </div>
        <p className="text-sm leading-relaxed text-[#6e6b7b]">{tk("searchApiDesc")}</p>
      </div>

      {/* Endpoints */}
      <Section title={tk("searchApiEndpoint")}>
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2"><MethodBadge method="POST" /><code className="text-xs font-mono text-[#5e5873]">/api/search/search</code></div>
          <p className="pl-14 text-sm text-[#6e6b7b]">{tk("searchApiPostDesc")}</p>
          <div className="flex items-center gap-2"><MethodBadge method="GET" /><code className="text-xs font-mono text-[#5e5873]">/api/search/search</code></div>
          <p className="pl-14 text-sm text-[#6e6b7b]">{tk("searchApiGetDesc")}</p>
        </div>
        <p className="text-sm text-[#6e6b7b]">{tk("searchApiAuthDesc")}</p>
      </Section>

      {/* POST Body */}
      <Section title={tk("searchApiBodyTitle")}>
        <Table headers={["Parameter", "Description"]}>
          {BODY_PARAMS.map((p) => <ParamRow key={p.key} name={p.key}>{tk(p.tk)}</ParamRow>)}
        </Table>
        <div className="mt-4">
          <CodeBlock title="POST /api/search/search" code={`{
  "text": "trapano batteria",
  "lang": "it",
  "channel": "b2c",
  "start": 0,
  "rows": 20,
  "filters": {
    "category_ancestors": "cat-utensili",
    "brand_id": ["bosch", "makita"],
    "stock_status": "in_stock",
    "price_min": 50,
    "price_max": 200,
    "attribute_color_s": "blue",
    "spec_voltage_f": "18"
  },
  "sort": { "field": "price", "order": "asc" },
  "include_faceting": true,
  "facet_fields": [
    "category_ancestors", "brand_id", "stock_status",
    "price", "has_active_promo",
    "attribute_color_s", "spec_voltage_f"
  ],
  "customer_code": "CUST001",
  "address_code": "ADDR001"
}`} />
        </div>
      </Section>

      {/* GET params */}
      <Section title={tk("searchApiGetTitle")}>
        <p className="mb-4 text-sm text-[#6e6b7b]">{tk("searchApiGetFilterPrefix")}</p>
        <CodeBlock title="GET Examples" code={`# Simple text search
GET /api/search/search?lang=it&text=trapano&rows=20

# With filters (filter_ prefix)
GET /api/search/search?lang=it&text=trapano&filter_brand_id=bosch&filter_stock_status=in_stock

# Multiple values (comma or repeated)
GET /api/search/search?lang=it&filter_brand_id=bosch,makita
GET /api/search/search?lang=it&filter_brand_id=bosch&filter_brand_id=makita

# Array notation
GET /api/search/search?lang=it&filter_brand_id[]=bosch&filter_brand_id[]=makita

# Dynamic attribute filter
GET /api/search/search?lang=it&filter_attribute_color_s=red

# Dynamic spec filter
GET /api/search/search?lang=it&filter_spec_voltage_f=18

# Sort and pagination
GET /api/search/search?lang=it&sort_field=price&sort_order=asc&start=20&rows=20

# Variant grouping
GET /api/search/search?lang=it&text=scarpa&group_variants=true

# Tag-based pricing
GET /api/search/search?lang=it&customer_code=CUST001&address_code=ADDR001
GET /api/search/search?lang=it&tag_filter=wholesale,premium`} />
      </Section>

      {/* URL to Search Body Transformation */}
      <Section title={tk("searchApiUrlTransformTitle")}>
        <p className="mb-3 text-sm text-[#6e6b7b]">{tk("searchApiUrlTransformDesc")}</p>
        <div className="mb-4 rounded-[0.358rem] border border-[#009688] bg-[rgba(0,150,136,0.04)] p-4">
          <p className="mb-2 text-xs font-semibold text-[#009688]">{tk("searchApiUrlTransformFormat")}</p>
          <ul className="space-y-1.5">
            <Bullet>{tk("searchApiUrlTransformText")}</Bullet>
            <Bullet>{tk("searchApiUrlTransformFilters")}</Bullet>
            <Bullet>{tk("searchApiUrlTransformMulti")}</Bullet>
            <Bullet>{tk("searchApiUrlTransformDynamic")}</Bullet>
            <Bullet>{tk("searchApiUrlTransformPrefixes")}</Bullet>
          </ul>
        </div>
        <CodeBlock title="Transformation: Storefront URL → POST body" code={`┌─────────────────────────────────────────────────────────────────────────────┐
│ STOREFRONT URL                                                              │
│ shop?text=trapano&filters-brand_id=bosch;makita&filters-stock_status=in_stock│
└─────────────────────────────────────────────────────────────────────────────┘
                              ▼ transformed to ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ POST /api/search/search                                                      │
│ {                                                                            │
│   "text": "trapano",                      ← from text=trapano               │
│   "lang": "it",                           ← default                        │
│   "rows": 20,                             ← default                        │
│   "start": 0,                             ← default                        │
│   "filters": {                                                               │
│     "brand_id": "bosch;makita",           ← filters-brand_id (prefix stripped)│
│     "stock_status": "in_stock"            ← filters-stock_status             │
│   }                                                                          │
│ }                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘`} />

        <CodeBlock title="Multiple Values — Storefront URL format (semicolons)" code={`# Single value
shop?text=trapano&filters-brand_id=bosch
→ { "text": "trapano", "filters": { "brand_id": "bosch" } }

# Multiple values for ONE filter (semicolons = OR logic)
shop?text=trapano&filters-brand_id=bosch;makita;dewalt
→ { "text": "trapano", "filters": { "brand_id": "bosch;makita;dewalt" } }

# Multiple values across DIFFERENT filters
shop?text=trapano&filters-brand_id=bosch;makita&filters-stock_status=in_stock&filters-category_ancestors=cat-utensili
→ {
    "text": "trapano",
    "filters": {
      "brand_id": "bosch;makita",
      "stock_status": "in_stock",
      "category_ancestors": "cat-utensili"
    }
  }

# Multiple dynamic attribute values
shop?filters-attribute_color_s=red;blue;green&filters-attribute_is_new_b=true
→ { "filters": { "attribute_color_s": "red;blue;green", "attribute_is_new_b": "true" } }

# Multiple spec values
shop?text=caldaia&filters-spec_power_f=24;28&filters-spec_type_s=condensing
→ { "text": "caldaia", "filters": { "spec_power_f": "24;28", "spec_type_s": "condensing" } }`} />

        <CodeBlock title="Multiple Values — Direct API GET format (commas or repeated params)" code={`# The /api/search/search GET endpoint uses a DIFFERENT convention:
# comma-separated values OR repeated params OR array notation []

# Comma-separated
GET /api/search/search?lang=it&filter_brand_id=bosch,makita,dewalt

# Repeated params
GET /api/search/search?lang=it&filter_brand_id=bosch&filter_brand_id=makita

# Array notation
GET /api/search/search?lang=it&filter_brand_id[]=bosch&filter_brand_id[]=makita

# All three produce the same result:
→ filters: { brand_id: ["bosch", "makita", "dewalt"] }

# Mixing filters
GET /api/search/search?lang=it&text=trapano&filter_brand_id=bosch,makita&filter_stock_status=in_stock&filter_attribute_color_s=red,blue

# Dynamic attributes — same comma convention
GET /api/search/search?lang=it&filter_attribute_color_s=red,blue,green
GET /api/search/search?lang=it&filter_spec_voltage_f=12,18,24`} />

        <CodeBlock title="Summary: Two URL formats" code={`┌──────────────────────────────────────────────────────────────────┐
│ FORMAT              │ SEPARATOR │ PREFIX       │ USED BY         │
├──────────────────────────────────────────────────────────────────┤
│ Storefront URL      │ ;         │ filters-     │ ProductSearch   │
│                     │           │              │ Preview, B2C    │
│                     │           │              │ storefront      │
├──────────────────────────────────────────────────────────────────┤
│ Direct API GET      │ , or      │ filter_      │ External API    │
│                     │ repeated  │ (underscore) │ clients,        │
│                     │ params    │              │ integrations    │
└──────────────────────────────────────────────────────────────────┘

Note: POST body always uses arrays for multiple values:
  { "filters": { "brand_id": ["bosch", "makita"] } }`} />

        <CodeBlock title="ProductSearchPreview Component" code={`The ProductSearchPreview component (src/components/shared/ProductSearchPreview.tsx)
performs the storefront URL → POST body transformation automatically.

It accepts either:
  • A simple keyword:   "trapano"
    → { "text": "trapano" }

  • An advanced query:  "shop?text=moon&filters-brand_id=004"
    → { "text": "moon", "filters": { "brand_id": "004" } }

  • Multiple filters:   "shop?text=scarpa&filters-brand_id=nike;adidas&filters-attribute_color_s=red"
    → { "text": "scarpa", "filters": { "brand_id": "nike;adidas", "attribute_color_s": "red" } }

The component also displays a visual badge summary of the parsed
keyword and active filters.`} />
      </Section>

      {/* Standard Filters */}
      <Section title={tk("searchApiStandardTitle")}>
        <p className="mb-4 text-sm text-[#6e6b7b]">{tk("searchApiStandardDesc")}</p>
        <Table headers={["Filter Key", "Description"]}>
          {STANDARD_FILTERS.map((f) => <ParamRow key={f.key} name={f.key}>{tk(f.tk)}</ParamRow>)}
        </Table>
      </Section>

      {/* Dynamic Attribute Filters */}
      <Section title={tk("searchApiDynamicTitle")}>
        <p className="mb-3 text-sm text-[#6e6b7b]">{tk("searchApiDynamicDesc")}</p>
        <p className="mb-3 text-sm font-medium text-[#5e5873]">{tk("searchApiDynamicConvention")}</p>
        <ul className="mb-4 space-y-1.5">
          <Bullet><code className="font-mono text-xs text-[#009688]">_s</code> — {tk("searchApiDynamicSuffix_s")}</Bullet>
          <Bullet><code className="font-mono text-xs text-[#009688]">_ss</code> — {tk("searchApiDynamicSuffix_ss")}</Bullet>
          <Bullet><code className="font-mono text-xs text-[#009688]">_f</code> — {tk("searchApiDynamicSuffix_f")}</Bullet>
          <Bullet><code className="font-mono text-xs text-[#009688]">_b</code> — {tk("searchApiDynamicSuffix_b")}</Bullet>
        </ul>
        <p className="mb-4 text-sm text-[#6e6b7b]">{tk("searchApiDynamicHow")}</p>
        <CodeBlock title="Dynamic Attribute Filter Examples" code={`// POST body — single value
"filters": { "attribute_color_s": "red" }

// POST body — multiple values (OR logic)
"filters": { "attribute_color_s": ["red", "blue"] }

// POST body — boolean attribute
"filters": { "attribute_is_new_b": true }

// POST body — numeric attribute
"filters": { "attribute_weight_f": "2.5" }

// GET — same filters via URL
filter_attribute_color_s=red
filter_attribute_color_s=red,blue
filter_attribute_is_new_b=true`} />
      </Section>

      {/* Dynamic Spec Filters */}
      <Section title={tk("searchApiSpecTitle")}>
        <p className="mb-3 text-sm text-[#6e6b7b]">{tk("searchApiSpecDesc")}</p>
        <p className="mb-3 text-sm font-medium text-[#5e5873]">{tk("searchApiSpecConvention")}</p>
        <p className="mb-3 text-sm text-[#6e6b7b]">{tk("searchApiSpecExamples")}</p>
        <p className="mb-4 text-sm text-[#6e6b7b]">{tk("searchApiSpecHow")}</p>
        <CodeBlock title="Dynamic Spec Filter Examples" code={`// POST body
"filters": {
  "spec_material_s": "stainless steel",
  "spec_voltage_f": "220",
  "spec_waterproof_b": true
}

// As facet fields (to build filter UI)
"facet_fields": ["spec_material_s", "spec_voltage_f", "spec_waterproof_b"]

// GET
filter_spec_material_s=stainless+steel
filter_spec_voltage_f=220`} />
      </Section>

      {/* Facet Fields */}
      <Section title={tk("searchApiFacetsTitle")}>
        <p className="mb-3 text-sm text-[#6e6b7b]">{tk("searchApiFacetsDesc")}</p>
        <ul className="mb-4 space-y-1.5">
          <Bullet>{tk("searchApiFacetsDefault")}</Bullet>
          <Bullet>{tk("searchApiFacetsTypes")}</Bullet>
          <Bullet>{tk("searchApiFacetsDynamic")}</Bullet>
        </ul>
      </Section>

      {/* Sort Options */}
      <Section title={tk("searchApiSortTitle")}>
        <p className="mb-3 text-sm text-[#6e6b7b]">{tk("searchApiSortDesc")}</p>
        <ul className="space-y-1.5">
          {SORT_OPTIONS.map((k) => <Bullet key={k}>{tk(k)}</Bullet>)}
        </ul>
      </Section>

      {/* Tag-Based Pricing */}
      <Section title={tk("searchApiTagsTitle")}>
        <p className="mb-3 text-sm text-[#6e6b7b]">{tk("searchApiTagsDesc")}</p>
        <ul className="mb-4 space-y-1.5">
          <Bullet>{tk("searchApiTagsCustomer")}</Bullet>
          <Bullet>{tk("searchApiTagsExplicit")}</Bullet>
          <Bullet>{tk("searchApiTagsNone")}</Bullet>
        </ul>
        <CodeBlock title="Tag Pricing Examples" code={`// Authenticated customer — resolve from DB
{ "customer_code": "CUST001", "address_code": "ADDR001" }

// Guest user — explicit empty tags (strip tag-restricted packaging)
{ "tag_filter": [] }

// Specific tags (e.g., storefront override)
{ "tag_filter": ["wholesale", "premium"] }

// No customer context — all packaging stripped from response`} />
      </Section>

      {/* Response */}
      <Section title={tk("searchApiResponseTitle")}>
        <CodeBlock title="Success Response" code={`{
  "success": true,
  "data": {
    "total": 342,
    "query": "trapano batteria",
    "results": [
      {
        "entity_code": "NAT.BIO-4082",
        "sku": "ABC-123",
        "name": "Trapano a batteria 18V",
        "brand": "Bosch",
        "category": "Utensili elettrici",
        "price": 89.90,
        "currency": "EUR",
        "stock_status": "in_stock",
        "image": "https://cdn.example.com/img.jpg",
        "packaging_options": [
          {
            "pkg_id": "1",
            "code": "PZ",
            "qty": 1,
            "pricing": { "list": 89.90, "sale": 79.90, "currency": "EUR" },
            "promotions": [{ "promo_code": "016", "discount_percentage": 10 }]
          }
        ],
        "relevance_score": 125.4
      }
    ],
    "facet_results": {
      "category_ancestors": [
        { "value": "cat-utensili", "count": 120, "label": "Utensili", "hierarchy": [...] }
      ],
      "brand_id": [
        { "value": "bosch", "count": 45, "label": "Bosch", "logo_url": "..." },
        { "value": "makita", "count": 32, "label": "Makita" }
      ],
      "price": [
        { "value": "0-50", "count": 15, "label": "€0 - €50" },
        { "value": "50-100", "count": 28, "label": "€50 - €100" }
      ],
      "attribute_color_s": [
        { "value": "blue", "count": 18 },
        { "value": "red", "count": 12 }
      ],
      "spec_voltage_f": [
        { "value": "12", "count": 20 },
        { "value": "18", "count": 45 }
      ]
    },
    "pagination": { "total": 342, "start": 0, "rows": 20, "pages": 18 }
  }
}`} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <H3>{title}</H3>
      {children}
    </div>
  );
}
