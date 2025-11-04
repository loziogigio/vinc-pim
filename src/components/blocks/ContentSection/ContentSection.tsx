"use client";

import { Fragment, createElement, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
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
    void import("dompurify").then((module) => {
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

const BOOLEAN_ATTRIBUTES = new Set([
  "allowfullscreen",
  "allowFullScreen",
  "autoplay",
  "checked",
  "controls",
  "disabled",
  "hidden",
  "loop",
  "multiple",
  "muted",
  "playsinline",
  "readonly",
  "required",
  "selected"
]);

const ATTRIBUTE_RENAMES: Record<string, string> = {
  allowfullscreen: "allowFullScreen"
};

const toCamelCase = (value: string) =>
  value.replace(/-([a-z0-9])/gi, (_, char: string) => char.toUpperCase());

const styleStringToObject = (styleString: string): CSSProperties => {
  const style: CSSProperties = {};
  styleString
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((declaration) => {
      const [property, rawValue] = declaration.split(":");
      if (!property || rawValue === undefined) return;
      const name = toCamelCase(property.trim());
      (style as any)[name] = rawValue.trim();
    });
  return style;
};

const convertNodeToReact = (node: ChildNode, key: string): ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const props: Record<string, unknown> = {};

    Array.from(element.attributes).forEach((attr) => {
      let name = ATTRIBUTE_RENAMES[attr.name] ?? attr.name;
      const value = attr.value;

      if (name.includes("-") && !name.startsWith("data-") && !name.startsWith("aria-")) {
        name = toCamelCase(name);
      }

      if (name === "class") {
        name = "className";
      } else if (name === "for") {
        name = "htmlFor";
      }

      if (name === "style") {
        props.style = styleStringToObject(value);
        return;
      }

      if (BOOLEAN_ATTRIBUTES.has(name)) {
        if (!value || value.toLowerCase() === name.toLowerCase()) {
          props[name] = true;
          return;
        }
        props[name] = value;
        return;
      }

      props[name] = value;
    });

    const children = Array.from(element.childNodes)
      .map((child, index) => convertNodeToReact(child, `${key}-${index}`))
      .filter((child): child is ReactNode => child !== null);

    return createElement(
      element.tagName.toLowerCase(),
      { ...props, key },
      children.length > 0 ? children : undefined
    );
  }

  return null;
};

const parseHtmlToReactNodes = (html: string): ReactNode[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const template = document.createElement("template");
  template.innerHTML = html;
  return Array.from(template.content.childNodes)
    .map((node, index) => convertNodeToReact(node, `custom-html-${index}`))
    .filter((child): child is ReactNode => child !== null);
};

const ContentCustomHtml = ({ config }: { config: Extract<ContentBlockConfig, { variant: "customHtml" }> }) => {
  const [nodes, setNodes] = useState<ReactNode[]>([]);

  useEffect(() => {
    void import("dompurify").then((module) => {
      const DOMPurify = module.default;
      const sanitized = DOMPurify.sanitize(config.html, {
        RETURN_TRUSTED_TYPE: false,
        ADD_ATTR: ["style"],
        ALLOW_ARIA_ATTR: true
      });
      setNodes(parseHtmlToReactNodes(sanitized));
    });
  }, [config.html]);

  if (!nodes.length) {
    return null;
  }

  return (
    <>
      {nodes.map((node, index) => (
        <Fragment key={`custom-html-node-${index}`}>{node}</Fragment>
      ))}
    </>
  );
};

export const ContentSection = ({ config }: ContentSectionProps) => {
  switch (config.variant) {
    case "richText":
      return <ContentRichText config={config} />;
    case "features":
      return <ContentFeatures config={config} />;
    case "testimonials":
      return <ContentTestimonials config={config} />;
    case "customHtml":
      return <ContentCustomHtml config={config} />;
    default:
      return null;
  }
};
