"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PlanForm } from "@/components/subscriptions/PlanForm";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { ISubscriptionPlan } from "@/lib/types/subscription";

export default function EditSubscriptionPlanPage() {
  const { t } = useTranslation();
  const params = useParams<{ plan_id: string }>();
  const [plan, setPlan] = useState<ISubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/b2b/subscription-plans/${params.plan_id}`);
        const data = await res.json();
        if (data.success) setPlan(data.plan);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.plan_id]);

  if (loading) return <div className="p-6 text-muted-foreground">{t("pages.store.subscriptions.loading")}</div>;
  if (!plan) return <div className="p-6 text-muted-foreground">{t("pages.store.subscriptions.noPlansFound")}</div>;
  return <PlanForm existing={plan} />;
}
