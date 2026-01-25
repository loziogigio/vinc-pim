/**
 * Auth Layout
 *
 * Minimal layout for authentication pages.
 * No navigation, just the content.
 */

import { Public_Sans } from "next/font/google";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Accedi - VINC Commerce Suite",
  description: "Accedi al tuo account VINC Commerce Suite",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={publicSans.className}>
      {children}
    </div>
  );
}
