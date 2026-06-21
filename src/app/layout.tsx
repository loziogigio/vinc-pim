import type { Metadata } from "next";
import { Inter, Schibsted_Grotesk, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import clsx from "clsx";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// VINC design-system fonts — exposed as CSS variables so surfaces (e.g. the
// Commerce Suite login) can opt into the brand type without changing the
// app-wide body font.
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-schibsted" });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-instrument" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "VINC Trade Supply Storefront",
  description: "Next.js storefront prototype for plumbing and bathroom trade supplies.",
  icons: { icon: "/favicon.png" }
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const themeInitScript = `
(() => {
  try {
    const storageKey = "vinc-theme";
    const root = document.documentElement;
    const stored = window.localStorage.getItem(storageKey);
    const mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const system = mql && mql.matches ? "dark" : "light";
    const theme = stored === "light" || stored === "dark" ? stored : system;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  } catch {
    // no-op
  }
})();
`;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning className={clsx(schibsted.variable, instrument.variable, jetbrains.variable)}>
      <body className={clsx(inter.className, "bg-background text-foreground")}>
        <Script id="theme-initializer" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
