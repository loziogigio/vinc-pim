/**
 * Agent Tag Service
 *
 * Translates an ERP sales-agent code into a reserved `agente:<code>` customer
 * tag. Agent tags are auto-created and assigned by the customer import; they
 * ride the existing customer-tag mechanism so promotions can target them via
 * `tag_filter` with no new filtering logic.
 */

import { connectWithModels } from "@/lib/db/connection";
import type { ICustomerTagRef } from "@/lib/db/models/customer-tag";
import { upsertTagRef } from "@/lib/services/tag-pricing.service";
import {
  AGENT_TAG_PREFIX,
  normalizeAgentCode,
  buildFullTag,
} from "@/lib/constants/customer-tag";

export interface AgentImportFields {
  agent_code?: string | null;
  agent_name?: string;
  addresses?: Array<{
    external_code?: string;
    agent_code?: string | null;
    agent_name?: string;
  }>;
}

/**
 * Pure: apply an agent ref to a tag-ref array.
 * - ref present  → replace any existing `agente:` ref with it (one agent max)
 * - ref === null → remove any `agente:` ref (clear)
 */
export function applyAgentToRefs(
  refs: ICustomerTagRef[],
  ref: ICustomerTagRef | null,
): ICustomerTagRef[] {
  const withoutAgent = (refs || []).filter((t) => t.prefix !== AGENT_TAG_PREFIX);
  return ref ? upsertTagRef(withoutAgent, ref) : withoutAgent;
}

/**
 * Upsert the `agente:<code>` tag definition and return its ref.
 * Returns null when the raw code normalizes to nothing.
 */
export async function ensureAgentTagDef(
  tenantDb: string,
  rawCode: string,
  name?: string,
): Promise<ICustomerTagRef | null> {
  const code = normalizeAgentCode(rawCode);
  if (!code) return null;

  const full_tag = buildFullTag(AGENT_TAG_PREFIX, code);
  const { CustomerTag } = await connectWithModels(tenantDb);

  const trimmedName = name?.trim();
  const set: Record<string, unknown> = { is_active: true };
  const setOnInsert: Record<string, unknown> = {
    prefix: AGENT_TAG_PREFIX,
    code,
    full_tag,
  };
  if (trimmedName) set.description = trimmedName;
  else setOnInsert.description = code;

  const doc = await CustomerTag.findOneAndUpdate(
    { full_tag },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  return {
    tag_id: (doc as { tag_id: string }).tag_id,
    full_tag,
    prefix: AGENT_TAG_PREFIX,
    code,
  };
}

/**
 * Resolve the agent action for a raw code:
 * - explicit null/empty → clear (return null)
 * - junk that normalizes to nothing → skip (return "skip")
 * - valid code → ensure def + return its ref
 */
async function resolveAgentAction(
  tenantDb: string,
  rawCode: string | null | undefined,
  name?: string,
): Promise<ICustomerTagRef | null | "skip"> {
  if (rawCode === null || String(rawCode ?? "").trim() === "") return null;
  const ref = await ensureAgentTagDef(tenantDb, String(rawCode), name);
  return ref ?? "skip";
}

/**
 * Apply customer-level and address-level agent assignment/clearing onto a
 * customer document, based on the import payload. Loads the customer once,
 * mutates tags / address tag_overrides, saves once.
 */
export async function applyCustomerAgentTags(
  tenantDb: string,
  tenantId: string,
  customerId: string,
  customerData: AgentImportFields,
): Promise<void> {
  const hasCustomerAgent = customerData.agent_code !== undefined;
  const addrAgents = (customerData.addresses || []).filter(
    (a) => a.agent_code !== undefined && !!a.external_code,
  );
  if (!hasCustomerAgent && addrAgents.length === 0) return;

  const { Customer } = await connectWithModels(tenantDb);
  const customer = await Customer.findOne({
    customer_id: customerId,
    tenant_id: tenantId,
  });
  if (!customer) return;

  if (hasCustomerAgent) {
    const action = await resolveAgentAction(
      tenantDb,
      customerData.agent_code,
      customerData.agent_name,
    );
    if (action !== "skip") {
      customer.tags = applyAgentToRefs(customer.tags || [], action);
    }
  }

  if (addrAgents.length > 0) {
    for (const a of addrAgents) {
      const idx = (customer.addresses || []).findIndex(
        (ad: { external_code?: string }) => ad.external_code === a.external_code,
      );
      if (idx === -1) continue;
      const action = await resolveAgentAction(tenantDb, a.agent_code, a.agent_name);
      if (action === "skip") continue;
      customer.addresses[idx].tag_overrides = applyAgentToRefs(
        customer.addresses[idx].tag_overrides || [],
        action,
      );
    }
    customer.markModified("addresses");
  }

  await customer.save();
}
