import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Customers & Users API",
  description:
    "REST reference for the bulk-import endpoints that push companies (customers) and portal users into a VINC Commerce Suite tenant.",
};

export default function CustomersDocsLayout({ children }: { children: ReactNode }) {
  return children;
}
