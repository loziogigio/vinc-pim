import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VINC Storefront Admin",
  description: "Private storefront administration tools"
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
