import { Building2, Users, type LucideIcon } from "lucide-react";

export interface CustomersDocSection {
  /** URL slug under /developers/customers/ — also matches the MDX filename (without extension). */
  slug: string;
  /** Title rendered in the sidebar and index grid. */
  title: string;
  /** One-line blurb for the sidebar tooltip / index grid. */
  description: string;
  /** Lucide icon. */
  icon: LucideIcon;
}

/**
 * Source of truth for the public "Customers & Users" developer-docs navigation.
 *
 * Covers the two bulk-import endpoints an external system (ERP, legacy portal)
 * uses to push companies and their portal logins into a tenant. Each slug maps
 * 1:1 to a file at `content/developers/customers/<slug>.mdx`.
 */
export const CUSTOMERS_DOC_SECTIONS: CustomersDocSection[] = [
  {
    slug: "companies",
    title: "Companies",
    description:
      "Bulk-import companies (customers) and their delivery / billing addresses.",
    icon: Building2,
  },
  {
    slug: "portal-users",
    title: "Portal Users",
    description:
      "Bulk-import portal logins and link each user to one or more companies.",
    icon: Users,
  },
];

export function getSection(slug: string): CustomersDocSection | undefined {
  return CUSTOMERS_DOC_SECTIONS.find((s) => s.slug === slug);
}
