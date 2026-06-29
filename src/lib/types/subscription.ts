import type {
  ISubscriptionPlan,
  IPlanBillingOption,
  IPlanMetric,
} from "@/lib/db/models/subscription-plan";
import type { PlanStatus, PlanKind, CheckoutMode } from "@/lib/constants/subscription";
import type { MultiLangString } from "@/lib/types/pim";

export type {
  ISubscriptionPlan,
  IPlanBillingOption,
  IPlanMetric,
  PlanStatus,
  PlanKind,
  CheckoutMode,
};

export interface CreatePlanRequest {
  channel: string;
  code: string;
  name: MultiLangString;
  description?: MultiLangString;
  feature_bullets?: MultiLangString[];
  is_featured?: boolean;
  public?: boolean;
  sort_order?: number;
  currency?: string;
  billing_options: IPlanBillingOption[];
  metrics?: IPlanMetric[];
  trial_days?: number | null;
  sandbox_included?: boolean;
  entitlements?: Record<string, string | number | boolean>;
  kind?: PlanKind;
  checkout_mode?: CheckoutMode;
  status?: PlanStatus;
}

export type UpdatePlanRequest = Partial<CreatePlanRequest>;
