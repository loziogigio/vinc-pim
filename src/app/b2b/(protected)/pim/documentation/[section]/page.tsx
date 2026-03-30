/**
 * PIM Documentation - Individual Section Page
 * Accessible at: /b2b/pim/documentation/[section]
 */

import { DocSectionPage } from "@/components/pim/docs/DocSectionPage";
import { DocSearchApi } from "@/components/pim/docs/DocSearchApi";

export const metadata = {
  title: "Documentation | PIM",
  description: "PIM documentation section",
};

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  // Search API gets its own dedicated component (it's the biggest section)
  if (section === "search-api") {
    return <DocSearchApi />;
  }

  return <DocSectionPage section={section} />;
}
