"use client";

import { useEffect, useState } from "react";
import type { ContentBlockConfig } from "@/lib/types/blocks";

interface ContentSectionProps {
  config: ContentBlockConfig;
}

const paddingClassMap = {
  none: "py-0",
  small: "py-6",
  medium: "py-10",
  large: "py-16"
} as const;

const widthClassMap = {
  full: "w-full",
  contained: "mx-auto max-w-3xl"
} as const;

const textAlignMap = {
  left: "text-left",
  center: "text-center",
  right: "text-right"
} as const;

const ContentRichText = ({ config }: { config: Extract<ContentBlockConfig, { variant: "richText" }> }) => {
  const [sanitizedContent, setSanitizedContent] = useState("");

  useEffect(() => {
    // Dynamically import DOMPurify only on client-side
    import("dompurify").then((module) => {
      const DOMPurify = module.default;
      setSanitizedContent(DOMPurify.sanitize(config.content));
    });
  }, [config.content]);

  return (
    <div
      className={`${widthClassMap[config.width]} ${paddingClassMap[config.padding]} ${textAlignMap[config.textAlign]}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

const ContentFeatures = ({ config }: { config: Extract<ContentBlockConfig, { variant: "features" }> }) => {
  const desktopCols = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4"
  } as const;

  const tabletCols = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3"
  } as const;

  const desktopClass = desktopCols[config.columns.desktop as keyof typeof desktopCols] ?? "md:grid-cols-3";
  const tabletClass = tabletCols[config.columns.tablet as keyof typeof tabletCols] ?? "sm:grid-cols-2";

  return (
    <div className="space-y-6">
      {config.title ? <h2 className="text-xl font-semibold md:text-2xl">{config.title}</h2> : null}
      <div className={`grid gap-6 ${tabletClass} ${desktopClass}`}>
        {config.features.map((feature, index) => (
          <div key={index} className="rounded-2xl border bg-card p-6 shadow-sm">
            {feature.icon ? <div className="text-2xl">{feature.icon}</div> : null}
            <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
            {feature.description ? <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const ContentTestimonials = ({
  config
}: {
  config: Extract<ContentBlockConfig, { variant: "testimonials" }>;
}) => (
  <div className="space-y-6">
    {config.title ? <h2 className="text-xl font-semibold md:text-2xl">{config.title}</h2> : null}
    <div className={`grid gap-6 ${config.layout === "grid" ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
      {config.testimonials.map((testimonial, index) => (
        <figure key={index} className="rounded-2xl border bg-card p-6 shadow-sm">
          <blockquote className="text-base leading-relaxed">“{testimonial.quote}”</blockquote>
          <figcaption className="mt-4 text-sm font-semibold">
            {testimonial.author}
            {testimonial.role ? <span className="ml-2 text-muted-foreground">{testimonial.role}</span> : null}
          </figcaption>
          {config.showRating && testimonial.rating ? (
            <div className="mt-2 flex gap-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, idx) => (
                <span key={idx}>{idx < (testimonial.rating ?? 0) ? "★" : "☆"}</span>
              ))}
            </div>
          ) : null}
        </figure>
      ))}
    </div>
  </div>
);

export const ContentSection = ({ config }: ContentSectionProps) => {
  switch (config.variant) {
    case "richText":
      return <ContentRichText config={config} />;
    case "features":
      return <ContentFeatures config={config} />;
    case "testimonials":
      return <ContentTestimonials config={config} />;
    default:
      return null;
  }
};
