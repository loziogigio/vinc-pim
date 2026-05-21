import { readFileSync } from "fs";
import path from "path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DocsShell } from "@/components/developers/docs/DocsShell";
import { extractTocFromMdx } from "@/components/developers/docs/toc-utils";
import {
  CUSTOMERS_DOC_SECTIONS,
  getSection,
} from "@content/developers/customers/_sections";

export function generateStaticParams() {
  return CUSTOMERS_DOC_SECTIONS.map((s) => ({ section: s.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const def = getSection(section);
  if (!def) return {};
  try {
    const mod = (await import(
      `../../../../../content/developers/customers/${section}.mdx`
    )) as {
      metadata?: Metadata;
    };
    return mod.metadata ?? { title: def.title, description: def.description };
  } catch {
    return { title: def.title, description: def.description };
  }
}

export default async function CustomersDocSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const def = getSection(section);
  if (!def) notFound();

  const { default: Content } = (await import(
    `../../../../../content/developers/customers/${section}.mdx`
  )) as { default: React.ComponentType };

  const source = readFileSync(
    path.join(process.cwd(), "content", "developers", "customers", `${section}.mdx`),
    "utf8",
  );
  const toc = extractTocFromMdx(source);

  return (
    <DocsShell toc={toc}>
      <Content />
    </DocsShell>
  );
}
