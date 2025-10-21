"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BackButton } from "@/components/b2b/BackButton";
import { Settings, Database, Bell, Shield, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function B2BSettingsPage() {
  const settingsSections = [
    {
      icon: Database,
      title: "ERP Integration",
      description: "Configure connection to your ERP system",
      action: "Configure",
    },
    {
      icon: Palette,
      title: "Product Mapping",
      description: "Map ERP fields to catalog attributes",
      action: "Edit Mapping",
      href: "/b2b/settings/mapping",
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Manage email and system notifications",
      action: "Configure",
    },
    {
      icon: Shield,
      title: "Access Control",
      description: "Manage user permissions and roles",
      action: "Manage Users",
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-[1400px] px-4 py-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Breadcrumbs items={[{ label: "Settings" }]} />
            <BackButton />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-xs text-muted-foreground">
                Configure your B2B catalog system
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-card p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Configuration</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {settingsSections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <div
                    key={index}
                    className="rounded-lg bg-muted/30 p-4 transition hover:bg-muted/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-foreground">
                          {section.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {section.description}
                        </p>
                        {"href" in section && section.href ? (
                          <Link
                            href={section.href}
                            className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
                          >
                            {section.action} →
                          </Link>
                        ) : (
                          <Button
                            variant="ghost"
                            className="mt-2 h-auto p-0 text-xs font-medium"
                          >
                            {section.action} →
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-card p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-1.5">
              <Database className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">System Information</h2>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b text-xs">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b text-xs">
                <span className="text-muted-foreground">Last Sync</span>
                <span className="font-medium">2 hours ago</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b text-xs">
                <span className="text-muted-foreground">Total Products</span>
                <span className="font-medium">5,247</span>
              </div>
              <div className="flex justify-between items-center py-2 text-xs">
                <span className="text-muted-foreground">Storage Used</span>
                <span className="font-medium">1.2 GB / 10 GB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
