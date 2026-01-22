"use client";

import { ReactNode } from "react";

interface AppLayoutProps {
  navigation?: ReactNode;
  children: ReactNode;
}

/**
 * Standard layout for apps with optional sidebar navigation.
 * Used by PIM, Store, Correlations, etc.
 */
export function AppLayout({ navigation, children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {navigation}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
