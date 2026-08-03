"use client";

/**
 * B2B Portal forms admin page — /b2b/b2b/portals/[slug]/forms.
 *
 * The submissions tab was a fork of the B2C inbox; it now mounts the packaged
 * <SubmissionsInbox> through a B2B-scoped adapter, so selection, filtering and CSV
 * export are written once and both surfaces stay in sync. This page keeps only
 * what the package deliberately leaves to the host: breadcrumbs, the portal-name
 * fetch, the title, the tab bar, and the 409 NOT_MIGRATED banner (surfaced via the
 * inbox's onWriteError hook).
 */

import { useEffect, useState, use } from "react";
import { CmsAdminProvider, SubmissionsInbox } from "vinc-cms-admin/react";
import type { CmsAdminError } from "vinc-cms-admin";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { FormDefinitionsTab } from "@/components/b2c/FormDefinitionsTab";
import { useB2BPortalCmsAdapter } from "@/lib/cms-admin/b2b-portal-adapter";

type ActiveTab = "submissions" | "definitions";

export default function B2BFormsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();
  const adapter = useB2BPortalCmsAdapter(slug);

  const [activeTab, setActiveTab] = useState<ActiveTab>("submissions");
  const [portalName, setPortalName] = useState(slug);
  // A write (seen-toggle / delete) can fail because the tenant has not been
  // migrated; that gets a "run the migration" hint rather than a generic error.
  const [notMigrated, setNotMigrated] = useState(false);

  useEffect(() => {
    // GET returns the raw IB2BPortal doc (portal.name), NOT a { data } wrapper.
    fetch(`/api/b2b/b2b/portals/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.name) setPortalName(data.name);
      })
      .catch(() => {});
  }, [slug]);

  const handleWriteError = (err: CmsAdminError): boolean => {
    if (err.status === 409 && err.code === "NOT_MIGRATED") {
      setNotMigrated(true);
      return true;
    }
    return false;
  };

  const tabClasses = (tab: ActiveTab) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: t("nav.b2bPortal.portals"), href: "/b2b/b2b" },
          { label: portalName, href: `/b2b/b2b/portals/${slug}` },
          { label: t("pages.b2bPortal.forms.title") },
        ]}
      />

      <h1 className="text-xl font-semibold text-foreground">
        {t("pages.b2bPortal.forms.title")}
      </h1>

      {notMigrated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
          <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
        </div>
      )}

      <div className="flex border-b border-border">
        <button
          type="button"
          className={tabClasses("submissions")}
          onClick={() => setActiveTab("submissions")}
        >
          {t("pages.b2bPortal.forms.tabs.submissions")}
        </button>
        <button
          type="button"
          className={tabClasses("definitions")}
          onClick={() => setActiveTab("definitions")}
        >
          {t("pages.b2bPortal.forms.tabs.definitions")}
        </button>
      </div>

      {activeTab === "submissions" && (
        <CmsAdminProvider adapter={adapter}>
          <SubmissionsInbox onWriteError={handleWriteError} />
        </CmsAdminProvider>
      )}

      {activeTab === "definitions" && (
        <FormDefinitionsTab
          storefrontSlug={slug}
          apiBase={`/api/b2b/b2b/portals/${slug}/form-definitions`}
        />
      )}
    </div>
  );
}
