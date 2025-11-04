"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BackButton } from "@/components/b2b/BackButton";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  Database,
  Search,
  ArrowRight,
  Settings,
  Pencil,
  Trash2,
  Upload,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SourceCollection = {
  key: string;
  name: string;
  status: "active" | "paused" | "error";
  records: number;
};

type Field = {
  name: string;
  type: "string" | "number" | "array" | "object";
  example?: string;
  sampleKV?: Array<{ key: string; value: string | number; unit?: string }>;
  mapped?: boolean;
  required?: boolean;
};

export default function AttributesSchemaMappingPage() {
  const collections: SourceCollection[] = [
    { key: "products_erp", name: "products_erp", status: "active", records: 52347 },
    { key: "products_supplier", name: "products_supplier", status: "active", records: 48291 },
    { key: "products_custom", name: "products_custom", status: "active", records: 1234 },
  ];

  const [selectedCollection, setSelectedCollection] = useState<SourceCollection>(collections[0]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");

  const sourceFields: Field[] = [
    { name: "entity_code", type: "string", example: '"TENAGLIE PER CARPENTIERE"', mapped: true },
    { name: "sku_code", type: "string", example: '"010050"', mapped: true },
    { name: "product_name", type: "string", example: '"TENAGLIE PER CARPENTIERE"', mapped: true },
    {
      name: "technical_features",
      type: "array",
      sampleKV: [
        { key: "length", value: 220, unit: "mm" },
        { key: "weight", value: 310, unit: "gram" },
        { key: "material", value: "Carbon Steel", unit: "-" },
      ],
      mapped: true,
    },
    { name: "brand_info", type: "object", example: "{name, code, country}", mapped: true },
  ];

  const targetFields: Field[] = [
    { name: "entity_code", type: "string", example: "Unique identifier", mapped: true, required: true },
    { name: "sku", type: "string", example: "Product SKU", mapped: true, required: true },
    { name: "title", type: "string", example: "Product title", mapped: true, required: true },
    {
      name: "technical_specs",
      type: "array",
      example: "Array of {key, value, unit}",
      mapped: true,
    },
    { name: "brand", type: "object", example: "Brand information", mapped: true, required: true },
  ];

  const filteredSource = useMemo(
    () =>
      sourceFields.filter((f) =>
        `${f.name} ${f.type} ${f.example ?? ""}`.toLowerCase().includes(sourceQuery.toLowerCase())
      ),
    [sourceQuery]
  );
  const filteredTarget = useMemo(
    () =>
      targetFields.filter((f) =>
        `${f.name} ${f.type} ${f.example ?? ""}`.toLowerCase().includes(targetQuery.toLowerCase())
      ),
    [targetQuery]
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/b2b/dashboard" },
          { label: "PIM", href: "/b2b/pim" },
          { label: "Attributes — Schema & Mapping" }
        ]}
      />

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attributes — Schema & Mapping</h1>
          <p className="text-sm text-muted-foreground">
            Map external source fields to your standard product schema
          </p>
        </div>
        <div className="hidden gap-2 md:flex">
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" /> Export Template
          </Button>
          <Button size="sm">
            <Upload className="mr-2 h-4 w-4" /> Import Excel
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-3 rounded-lg bg-card p-4 shadow-sm border border-[#ebe9f1]">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Products</div>
            <div className="text-2xl font-semibold leading-tight">52,347</div>
            <div className="text-xs font-medium text-emerald-600">↑ 12.5%</div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-card p-4 shadow-sm border border-[#ebe9f1]">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Mapped Fields</div>
            <div className="text-2xl font-semibold leading-tight">24</div>
            <div className="text-xs font-medium text-emerald-600">↑ 8.2%</div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-card p-4 shadow-sm border border-[#ebe9f1]">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Unmapped</div>
            <div className="text-2xl font-semibold leading-tight">6</div>
            <div className="text-xs font-medium text-amber-600">↓ 3.1%</div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-card p-4 shadow-sm border border-[#ebe9f1]">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-100 text-sky-700">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Collections</div>
            <div className="text-2xl font-semibold leading-tight">3</div>
            <div className="text-xs font-medium text-emerald-600">Active</div>
          </div>
        </div>
      </div>

      {/* Mapping workspace */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left panel: Source */}
        <div className="overflow-hidden rounded-lg bg-card shadow-sm border border-[#ebe9f1]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Select Source Collection</span>
          </div>

          <div className="border-b p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedCollection(c)}
                  className={`rounded-md border p-3 text-left transition hover:border-primary hover:shadow-sm ${
                    selectedCollection.key === c.key ? "border-primary bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">{c.name}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-100">
                    Active
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{c.records.toLocaleString()} records</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Source Fields ({selectedCollection.name})</span>
            <span className="inline-flex items-center rounded bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              {sourceFields.length} fields
            </span>
          </div>

          <div className="border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="Search fields..."
                className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {filteredSource.map((f) => (
              <div key={f.name} className="border-b px-4 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{f.name}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.type}
                  </span>
                </div>
                {f.example ? (
                  <div className="text-xs text-muted-foreground">Example: {f.example}</div>
                ) : null}

                {f.sampleKV ? (
                  <div className="mt-2 rounded border bg-muted/30 p-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sample Data</div>
                    {f.sampleKV.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-[90px_1fr_70px] items-center gap-3 border-b py-1.5 last:border-b-0">
                        <div className="font-mono text-xs font-medium text-foreground">{row.key}</div>
                        <div className="truncate text-xs text-muted-foreground">{String(row.value)}</div>
                        <div className="text-right text-xs font-medium text-primary">{row.unit ?? "-"}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1">
                  {f.mapped ? (
                    <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">✓ Mapped</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: Target */}
        <div className="overflow-hidden rounded-lg bg-card shadow-sm border border-[#ebe9f1]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Target Schema</span>
            <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Standard
            </span>
          </div>

          <div className="border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder="Search fields..."
                className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {filteredTarget.map((f) => (
              <div key={f.name} className="border-b px-4 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{f.name}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.type}
                  </span>
                </div>
                {f.example ? (
                  <div className="text-xs text-muted-foreground">{f.example}</div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.required ? (
                    <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Required</span>
                  ) : null}
                  {f.mapped ? (
                    <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">✓ Mapped</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mapping rules */}
      <div className="overflow-hidden rounded-lg bg-card shadow-sm border border-[#ebe9f1]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Active Mapping Rules</div>
            <div className="text-xs text-muted-foreground">6 rules configured</div>
          </div>
          <Button size="sm">
            + Add Rule
          </Button>
        </div>

        <div className="space-y-2 p-4">
          {/* Direct */}
          <div className="rounded-md border p-4 hover:bg-muted/30">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Direct</span>
              <div className="flex gap-1">
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
              <div className="flex-1 rounded-md bg-sky-100 px-3 py-2 font-mono text-sm font-medium text-sky-700">entity_code</div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 rounded-md bg-emerald-100 px-3 py-2 font-mono text-sm font-medium text-emerald-700">entity_code</div>
            </div>
          </div>

          {/* Rename */}
          <div className="rounded-md border p-4 hover:bg-muted/30">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Rename</span>
              <div className="flex gap-1">
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
              <div className="flex-1 rounded-md bg-sky-100 px-3 py-2 font-mono text-sm font-medium text-sky-700">sku_code</div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 rounded-md bg-emerald-100 px-3 py-2 font-mono text-sm font-medium text-emerald-700">sku</div>
            </div>
          </div>

          {/* Transform */}
          <div className="rounded-md border p-4 hover:bg-muted/30">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Transform</span>
              <div className="flex gap-1">
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
              <div className="flex-1 rounded-md bg-sky-100 px-3 py-2 font-mono text-sm font-medium text-sky-700">product_name</div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 rounded-md bg-emerald-100 px-3 py-2 font-mono text-sm font-medium text-emerald-700">title</div>
            </div>
            <div className="mt-3 inline-flex items-center rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              ⚡ uppercase() → trim()
            </div>
          </div>

          {/* Array Transform */}
          <div className="rounded-md border p-4 hover:bg-muted/30">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Array Transform</span>
              <div className="flex gap-1">
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
              <div className="flex-1 rounded-md bg-sky-100 px-3 py-2 font-mono text-sm font-medium text-sky-700">technical_features[]</div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 rounded-md bg-emerald-100 px-3 py-2 font-mono text-sm font-medium text-emerald-700">technical_specs[]</div>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md bg-[#283046] p-3 text-xs leading-5 text-[#d0d2d6]">
{`map(item => ({
  key: item.property_name,
  value: item.property_value,
  unit: item.measurement_unit || "-"
}))`}
            </pre>
            <div className="mt-2 inline-flex items-center rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              ⚡ Excel Import Compatible
            </div>
          </div>

          {/* Dynamic Index */}
          <div className="rounded-md border p-4 hover:bg-muted/30">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Flat to Array (Dynamic Index)</span>
              <div className="flex gap-1">
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="inline-flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted/50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
              <div className="flex-1 rounded-md bg-sky-100 px-3 py-2 font-mono text-sm font-medium text-sky-700">
                technical_feature_{`{index}`}_key<br />
                technical_feature_{`{index}`}_value<br />
                technical_feature_{`{index}`}_dimension
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 rounded-md bg-emerald-100 px-3 py-2 font-mono text-sm font-medium text-emerald-700">technical_specs[]</div>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md bg-[#283046] p-3 text-xs leading-5 text-[#d0d2d6]">
{`// Pattern: {prefix}_{index}_{property}
// Extracts all matching columns and groups by index

const pattern = /^technical_feature_(\d+)_(key|value|dimension)$/;
const grouped: Record<string, any> = {};

Object.keys(row).forEach(col => {
  const match = col.match(pattern);
  if (match) {
    const [, index, prop] = match;
    if (!grouped[index]) grouped[index] = {};
    grouped[index][prop] = (row as any)[col];
  }
});

return Object.values(grouped).map((item: any) => ({
  key: item.key,
  value: item.value,
  unit: item.dimension || "-"
}));`}
            </pre>
            <div className="mt-2 inline-flex items-center rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              ⚡ Excel Pattern: {`{prefix}_{index}_{property}`}
            </div>
          </div>
        </div>
      </div>

      {/* Import from Excel */}
      <div className="overflow-hidden rounded-lg bg-card shadow-sm border border-[#ebe9f1]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Import from Excel</div>
            <div className="text-xs text-muted-foreground">Upload Excel file with key-value mappings</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" /> Export Template
            </Button>
            <Button size="sm">
              <Upload className="mr-2 h-4 w-4" /> Import Excel
            </Button>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="cursor-pointer rounded-md border-2 border-dashed bg-muted/30 p-10 text-center transition-colors hover:border-primary hover:bg-primary/5">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm font-medium">Drag and drop your Excel file here</div>
            <div className="text-xs text-muted-foreground">Supported: .xlsx, .xls</div>
          </div>

          <div className="rounded-md border bg-primary/5 p-4">
            <div className="mb-2 text-sm font-semibold">Expected Excel Structure</div>
            <div className="text-xs text-muted-foreground">
              Column A: <code className="rounded bg-background px-1 py-0.5">key</code> (property_name) <br />
              Column B: <code className="rounded bg-background px-1 py-0.5">value</code> (property_value) <br />
              Column C: <code className="rounded bg-background px-1 py-0.5">unit</code> (measurement_unit) <br />
              Column D: <code className="rounded bg-background px-1 py-0.5">domain</code> (category) <br />
              <div className="mt-2 font-semibold text-foreground">Example:</div>
              length | 10 | Meter | dimensions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
