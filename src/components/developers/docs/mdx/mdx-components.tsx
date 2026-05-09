import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Badge } from "./Badge";
import { Callout } from "./Callout";
import { CodeBlock } from "./CodeBlock";
import { Endpoint } from "./Endpoint";
import { ParamTable } from "./ParamTable";

/**
 * MDX component overrides for developer docs.
 *
 * Styled HTML primitives rely on Tailwind `prose` at the layout level;
 * these overrides mainly ensure links, inline code, and headings match
 * the app's existing palette (teal #009688 on light, slate on dark).
 */
export const docsMDXComponents: MDXComponents = {
  a: ({ href, children, ...rest }) => {
    const isInternal = typeof href === "string" && href.startsWith("/");
    if (isInternal) {
      return (
        <Link
          href={href as string}
          className="font-medium text-[#009688] underline decoration-[#009688]/40 underline-offset-2 hover:decoration-[#009688]"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target={href?.toString().startsWith("http") ? "_blank" : undefined}
        rel={href?.toString().startsWith("http") ? "noopener noreferrer" : undefined}
        className="font-medium text-[#009688] underline decoration-[#009688]/40 underline-offset-2 hover:decoration-[#009688]"
        {...rest}
      >
        {children}
      </a>
    );
  },
  code: ({ className, children, ...rest }) => {
    // Inline code (no language class). Block code is handled by rehype-pretty-code
    // which wraps inside <pre>; this path only fires for inline usage.
    const isBlock = typeof className === "string" && className.startsWith("language-");
    if (isBlock) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-[#f0f0f3] px-1 py-0.5 font-mono text-[0.88em] text-[#009688] dark:bg-white/10 dark:text-[#4dd0c8]"
        {...rest}
      >
        {children}
      </code>
    );
  },
  Badge,
  Callout,
  CodeBlock,
  Endpoint,
  ParamTable,
};
