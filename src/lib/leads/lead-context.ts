import { DEMO_DOMAINS } from "@/lib/demo/demo-access";
import { opportunityUrl } from "@/lib/services/crm-client";
import type { LeadAttribution } from "@/lib/services/deal.service";

export interface LeadContext {
  segmentLabel: string;
  demoUrl?: string;
  openingLine: string;
  crmUrl?: string;
  attributionLines: string[];
}

const SEGMENT_LABEL: Record<string, string> = {
  b2b: "Fornitore / Distributore", b2c: "Negozio / Brand",
  ufficio: "Rete vendita / Agenti", unsure: "Da qualificare",
};
const SEGMENT_DEMO: Record<string, string | undefined> = {
  b2b: `https://${DEMO_DOMAINS.b2b}`, b2c: `https://${DEMO_DOMAINS.b2c}`,
  ufficio: `https://${DEMO_DOMAINS.ufficio}`, unsure: `https://${DEMO_DOMAINS.hub}`,
};
// v1 drafts — founder refines from real call language.
const SEGMENT_OPENER: Record<string, string> = {
  b2b: "Gestite vendite verso una rete di clienti con listini dedicati — mostragli come un distributore simile ha tolto telefono/fax dal flusso ordini in 8 settimane.",
  b2c: "Vende al consumatore — apri sul confronto con Shopify e sul fatto che il B2B è nativo se un domani serve.",
  ufficio: "Gestisce agenti / rete vendita — punta su preventivi e storefront per rivenditori dall'Ufficio Digitale.",
  unsure: "Non si è ancora qualificato — fai la domanda 'cosa vendi e a chi' e indirizza alla superficie giusta.",
};

export function buildLeadContext(input: {
  buyer_segment: string;
  crm_opportunity_id?: string;
  attribution?: LeadAttribution;
  /** Twenty base URL for the deep link; falls back to env, then the default host. */
  crmBaseUrl?: string;
}): LeadContext {
  const seg = input.buyer_segment in SEGMENT_LABEL ? input.buyer_segment : "unsure";
  const a = input.attribution;
  const lines: string[] = [];
  const hasFullTouch = (a?.first && (a.first.channel || a.first.source)) || (a?.last && (a.last.channel || a.last.source));
  if (hasFullTouch) {
    if (a?.first && (a.first.channel || a.first.source)) {
      lines.push(`1° tocco: ${a.first.channel ?? "?"} / ${a.first.source ?? "?"}${a.first.campaign ? ` (camp: ${a.first.campaign})` : ""}`);
      if (a.first.landing_page) lines.push(`Landing: ${a.first.landing_page}`);
    }
    if (a?.last && (a.last.channel || a.last.source)) {
      lines.push(`Ultimo tocco: ${a.last.channel ?? "?"} / ${a.last.source ?? "?"}${a.last.campaign ? ` (camp: ${a.last.campaign})` : ""}`);
      if (a.last.landing_page) lines.push(`Landing ultimo: ${a.last.landing_page}`);
    }
    const touch = a?.last ?? a?.first;
    const clickIds = [touch?.gclid && "gclid", touch?.fbclid && "fbclid", touch?.li_fat_id && "li_fat_id"].filter(Boolean);
    lines.push(`Click-id presenti: ${clickIds.length ? clickIds.join(", ") : "no"}`);
  } else if (a?.marketing && (a.marketing.channel || a.marketing.source)) {
    lines.push(`Provenienza (coarse): ${a.marketing.channel ?? "?"} / ${a.marketing.source ?? "?"}`);
  } else {
    lines.push("Provenienza non tracciata (nessun consenso)");
  }
  return {
    segmentLabel: SEGMENT_LABEL[seg],
    demoUrl: SEGMENT_DEMO[seg],
    openingLine: SEGMENT_OPENER[seg],
    crmUrl: input.crm_opportunity_id
      ? opportunityUrl(input.crmBaseUrl || process.env.VINC_TWENTY_BASE_URL || "https://vinc.crm.vendereincloud.it", input.crm_opportunity_id)
      : undefined,
    attributionLines: lines,
  };
}
