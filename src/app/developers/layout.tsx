import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "VINC Developer Docs",
    template: "%s — VINC Developer Docs",
  },
  description:
    "Public developer documentation for the VINC Commerce Suite REST APIs.",
  robots: { index: true, follow: true },
};

export default function DevelopersLayout({ children }: { children: ReactNode }) {
  return children;
}
