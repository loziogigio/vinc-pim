# New B2B Application Development Guide

When adding a new B2B application, follow these steps:

## Step 1: Register in App Registry

Add the app to `src/config/apps.config.ts`:

```typescript
{
  id: "new-app",
  name: "New App",
  description: "Description here",
  href: "/b2b/new-app",
  icon: IconComponent,  // from lucide-react
  color: "bg-blue-500",
  showInLauncher: true,
  showInHeader: true,
  hasNavigation: true,
}
```

This automatically adds the app to the launcher dropdown, header detection, and tenant prefix path matching.

## Step 2: Create Folder Structure

```
src/app/b2b/(protected)/new-app/
├── layout.tsx           # Uses AppLayout + Navigation
├── page.tsx             # Main dashboard page
└── sub-section/
    └── page.tsx         # Sub-section pages
```

## Step 3: Create Navigation (if hasNavigation: true)

```typescript
// src/components/new-app/NewAppNavigation.tsx
"use client";
import { AppSidebar, NavLink } from "@/components/navigation";
import { LayoutDashboard, Folder, Settings } from "lucide-react";

export function NewAppNavigation() {
  return (
    <AppSidebar title="New App">
      <NavLink href="/b2b/new-app" icon={LayoutDashboard} label="Dashboard" />
      <NavLink href="/b2b/new-app/items" icon={Folder} label="Items" />
      <NavLink href="/b2b/new-app/settings" icon={Settings} label="Settings" />
    </AppSidebar>
  );
}
```

## Step 4: Create Layout

```typescript
// src/app/b2b/(protected)/new-app/layout.tsx
import { AppLayout } from "@/components/layouts/AppLayout";
import { NewAppNavigation } from "@/components/new-app/NewAppNavigation";

export default function NewAppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout navigation={<NewAppNavigation />}>{children}</AppLayout>;
}
```

## Step 5: Write Unit Tests

```typescript
// src/test/unit/new-app.test.ts
import { describe, it, expect } from "vitest";
import { getAppById, getAppByPath } from "@/config/apps.config";

describe("unit: New App Config", () => {
  it("should be registered in app registry", () => {
    const app = getAppById("new-app");
    expect(app).toBeDefined();
    expect(app?.name).toBe("New App");
  });

  it("should handle tenant-prefixed paths", () => {
    const app = getAppByPath("/tenant-id/b2b/new-app");
    expect(app?.id).toBe("new-app");
  });
});
```

## Shared Navigation Components

| Component    | Purpose                                     |
| ------------ | ------------------------------------------- |
| `NavLink`    | Navigation link with active state detection |
| `NavSection` | Collapsible section with items              |
| `AppSidebar` | Standard sidebar wrapper                    |

## App Registry Helper Functions

| Function                      | Returns                                  |
| ----------------------------- | ---------------------------------------- |
| `getAppById(id)`              | App config by ID                         |
| `getAppByPath(pathname)`      | App config matching pathname             |
| `getLauncherApps()`           | Apps for App Launcher dropdown           |
| `getHeaderApps()`             | Apps for header display                  |
| `getCurrentSection(pathname)` | Current section info (name, icon, color) |
