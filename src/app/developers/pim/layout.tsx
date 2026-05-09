import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PIM API",
  description:
    "REST reference for the PIM (Product Information Management) subsystem of VINC Commerce Suite.",
};

export default function PimDocsLayout({ children }: { children: ReactNode }) {
  return children;
}
