"use client";

import { useParams } from "next/navigation";
import { WindmillProxySettings } from "@/components/settings/WindmillProxySettings";
import { useTranslation } from "@/lib/i18n/useTranslation";

const VALID_SECTIONS = ["cart", "order", "pricing", "stock", "customer", "catalog"] as const;

const sectionTitleKeys: Record<string, string> = {
  cart: "nav.windmill.cart",
  order: "nav.windmill.order",
  pricing: "nav.windmill.pricing",
  stock: "nav.windmill.stock",
  customer: "nav.windmill.customer",
  catalog: "nav.windmill.catalog",
};

export default function WindmillSectionPage() {
  const params = useParams();
  const section = params?.section as string;
  const { t } = useTranslation();

  if (!VALID_SECTIONS.includes(section as typeof VALID_SECTIONS[number])) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Section not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t(sectionTitleKeys[section])} Hooks
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("pages.settings.windmill.sectionDesc", { section: t(sectionTitleKeys[section]) })}
        </p>
      </div>

      <WindmillProxySettings filterDomain={section} />
    </div>
  );
}
