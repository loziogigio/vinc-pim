"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { DestinationForm } from "@/components/feeds/DestinationForm";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function NewDestinationPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <Breadcrumbs
        items={[
          { label: t("pages.feeds.title"), href: "/b2b/feeds" },
          { label: t("pages.feeds.newDestination") },
        ]}
      />
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("pages.feeds.newDestination")}</h1>
      <DestinationForm />
    </div>
  );
}
