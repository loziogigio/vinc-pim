"use client";

/* eslint-disable @next/next/no-img-element */

import type { CSSProperties, ReactNode } from "react";
import type {
  ProductDataTableBlockConfig,
  ProductDataTableRowConfig
} from "@/lib/types/blocks";
import { sanitizeHtml } from "@/lib/security/sanitize-html";

const GRID_WIDTH_CLASS_MAP: Record<number, string> = {
  120: "sm:grid-cols-[120px,1fr]",
  130: "sm:grid-cols-[130px,1fr]",
  140: "sm:grid-cols-[140px,1fr]",
  150: "sm:grid-cols-[150px,1fr]",
  160: "sm:grid-cols-[160px,1fr]",
  170: "sm:grid-cols-[170px,1fr]",
  180: "sm:grid-cols-[180px,1fr]",
  190: "sm:grid-cols-[190px,1fr]",
  200: "sm:grid-cols-[200px,1fr]",
  210: "sm:grid-cols-[210px,1fr]",
  220: "sm:grid-cols-[220px,1fr]",
  230: "sm:grid-cols-[230px,1fr]",
  240: "sm:grid-cols-[240px,1fr]",
  250: "sm:grid-cols-[250px,1fr]",
  260: "sm:grid-cols-[260px,1fr]",
  270: "sm:grid-cols-[270px,1fr]",
  280: "sm:grid-cols-[280px,1fr]",
  290: "sm:grid-cols-[290px,1fr]",
  300: "sm:grid-cols-[300px,1fr]",
  310: "sm:grid-cols-[310px,1fr]",
  320: "sm:grid-cols-[320px,1fr]",
  330: "sm:grid-cols-[330px,1fr]",
  340: "sm:grid-cols-[340px,1fr]",
  350: "sm:grid-cols-[350px,1fr]",
  360: "sm:grid-cols-[360px,1fr]",
  370: "sm:grid-cols-[370px,1fr]",
  380: "sm:grid-cols-[380px,1fr]",
  390: "sm:grid-cols-[390px,1fr]",
  400: "sm:grid-cols-[400px,1fr]",
  410: "sm:grid-cols-[410px,1fr]",
  420: "sm:grid-cols-[420px,1fr]"
};

const clampColumnWidth = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 220;
  return Math.min(Math.max(Math.round(value), 120), 420);
};

const wrapWithLink = (node: ReactNode, row: ProductDataTableRowConfig) => {
  if (!node) {
    return null;
  }

  if (!row.link?.url) {
    return node;
  }

  const openInNewTab = row.link.openInNewTab ?? true;
  const rel = row.link.rel ?? (openInNewTab ? "noopener noreferrer nofollow" : undefined);

  return (
    <a
      href={row.link.url}
      target={openInNewTab ? "_blank" : undefined}
      rel={rel}
      className="inline-flex max-w-full items-center gap-2 text-emerald-600 hover:underline"
    >
      {node}
    </a>
  );
};

const renderLeftContent = (row: ProductDataTableRowConfig) => {
  const type = row.leftValueType ?? (row.valueType === "image" ? "text" : row.imageUrl ? "image" : "text");

  if (type === "image") {
    if (!row.imageUrl) {
      return <span className="text-xs text-slate-400">Nessuna immagine</span>;
    }
    const style: CSSProperties | undefined = row.imageAspectRatio ? { aspectRatio: row.imageAspectRatio } : undefined;
    return (
      <div className="flex flex-col items-center gap-2">
        <img
          src={row.imageUrl}
          alt={row.imageAlt || row.label}
          className="mx-auto h-auto max-h-16 w-auto object-contain"
          style={style}
          loading="lazy"
        />
        {row.label ? (
          <span className="text-[11px] font-medium text-slate-600">{row.label}</span>
        ) : null}
      </div>
    );
  }

  if (type === "html" && row.leftHtml) {
    return (
      <div
        className="prose prose-xs max-w-none text-slate-700"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.leftHtml) }}
      />
    );
  }

  return <span className="block whitespace-pre-wrap break-words text-slate-800">{row.label}</span>;
};

const wrapLeftContent = (node: ReactNode, row: ProductDataTableRowConfig) => {
  if (!node) return null;
  if (!row.leftLink?.url) {
    return node;
  }

  const openInNewTab = row.leftLink.openInNewTab ?? true;
  const rel = row.leftLink.rel ?? (openInNewTab ? "noopener noreferrer nofollow" : undefined);

  return (
    <a
      href={row.leftLink.url}
      target={openInNewTab ? "_blank" : undefined}
      rel={rel}
      className="inline-flex max-w-full items-center gap-2 text-emerald-600 hover:underline"
    >
      {node}
    </a>
  );
};

const renderRowValue = (row: ProductDataTableRowConfig) => {
  const type = row.valueType ?? "text";

  if (type === "image") {
    const imageUrl = row.valueImageUrl || row.imageUrl;
    if (!imageUrl) {
      return <span className="text-xs text-slate-400">Nessuna immagine</span>;
    }
    const style: CSSProperties | undefined = row.valueImageAspectRatio
      ? { aspectRatio: row.valueImageAspectRatio }
      : row.imageAspectRatio
      ? { aspectRatio: row.imageAspectRatio }
      : undefined;

    return (
      <img
        src={imageUrl}
        alt={row.valueImageAlt || row.imageAlt || row.label}
        className="mx-auto h-auto max-h-64 w-full max-w-xl rounded-md border border-slate-200 object-contain"
        style={style}
        loading="lazy"
      />
    );
  }

  if (type === "html" && row.html) {
    return (
      <div
        className="prose prose-sm max-w-none text-slate-700"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.html) }}
      />
    );
  }

  return <span className="block whitespace-pre-wrap break-words text-slate-800">{row.value ?? ""}</span>;
};

export interface ProductDataTableSectionProps {
  config: ProductDataTableBlockConfig;
}

export const ProductDataTableSection = ({ config }: ProductDataTableSectionProps) => {
  const columnWidth = clampColumnWidth(config.labelColumnWidth);
  const widthKey = Math.round(columnWidth / 10) * 10;
  const responsiveGridClass = GRID_WIDTH_CLASS_MAP[widthKey] ?? GRID_WIDTH_CLASS_MAP[220];

  const bordered = config.appearance?.bordered !== false;
  const rounded = config.appearance?.rounded !== false;
  const zebra = config.appearance?.zebraStripes === true;

  const containerClasses = [
    "overflow-hidden bg-white",
    bordered ? "border border-slate-200 shadow-sm" : "",
    rounded ? "rounded-xl" : "rounded-md"
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="space-y-4">
      {config.title ? <h3 className="text-xl font-semibold text-slate-900">{config.title}</h3> : null}
      {config.description ? (
        <p className="max-w-2xl text-sm text-slate-600">{config.description}</p>
      ) : null}

      <div className={containerClasses}>
        <dl className={`grid grid-cols-1 ${responsiveGridClass}`}>
          {config.rows?.map((row, index) => {
            const highlight = row.highlight === true;
            const zebraClass = zebra && index % 2 === 1 ? "bg-slate-50/70" : "";
            const highlightClass = highlight ? "border-l-4 border-emerald-500 bg-emerald-50/70" : "";
            const leftContent = wrapLeftContent(renderLeftContent(row), row) ?? (
              <span className="block whitespace-pre-wrap break-words text-slate-800">{row.label}</span>
            );

            return (
              <div key={row.id ?? `${row.label}-${index}`} className={`contents ${highlight ? "font-semibold text-emerald-900" : ""}`}>
                <dt
                  className={[
                    "border-b border-slate-200 bg-slate-50 px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs",
                    highlight ? "bg-emerald-100 text-emerald-700" : ""
                  ].join(" ")}
                >
                  <div className="space-y-2">
                    {leftContent}
                    {row.leftHelperText ? (
                      <p className="text-xs font-normal uppercase tracking-wide text-slate-400">
                        {row.leftHelperText}
                      </p>
                    ) : null}
                  </div>
                </dt>
                <dd
                  className={[
                    "border-b border-slate-200 px-4 py-3 text-sm text-slate-800",
                    zebraClass,
                    highlightClass
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="space-y-2">
                    {wrapWithLink(renderRowValue(row), row)}
                    {row.helperText ? (
                      <p className="text-xs font-normal uppercase tracking-wide text-slate-400">
                        {row.helperText}
                      </p>
                    ) : null}
                  </div>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
};
