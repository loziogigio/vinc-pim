"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { MenuBuilder } from "@/components/menu/menu-builder";
import { useState } from "react";

export default function MenuSettingsPage() {
  const [activeLocation, setActiveLocation] = useState<"header" | "footer" | "mobile">("header");

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Menu Settings" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Menu Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure your navigation menus with drag-and-drop. Add items from
          collections, categories, brands, and more.
        </p>
      </div>

      {/* Location Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveLocation("header")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "header"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Header Menu
        </button>
        <button
          onClick={() => setActiveLocation("footer")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "footer"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Footer Menu
        </button>
        <button
          onClick={() => setActiveLocation("mobile")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "mobile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mobile Menu
        </button>
      </div>

      {/* Menu Builder */}
      {activeLocation === "header" && <MenuBuilder location="header" />}
      {activeLocation === "footer" && <MenuBuilder location="footer" />}
      {activeLocation === "mobile" && <MenuBuilder location="mobile" />}
    </div>
  );
}
