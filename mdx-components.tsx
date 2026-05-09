import type { MDXComponents } from "mdx/types";
import { docsMDXComponents } from "@/components/developers/docs/mdx/mdx-components";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    ...docsMDXComponents,
  };
}
