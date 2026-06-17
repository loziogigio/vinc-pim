export interface TwentyConfig { baseUrl: string; apiKey: string; }

export function opportunityUrl(baseUrl: string, id: string): string {
  return `${baseUrl.replace(/\/$/, "")}/object/opportunity/${id}`;
}
export function microsToNumber(micros?: number): number | undefined {
  return typeof micros === "number" ? micros / 1_000_000 : undefined;
}

export class TwentyClient {
  constructor(private readonly cfg: TwentyConfig) {}
  private headers() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` };
  }
  private base() { return this.cfg.baseUrl.replace(/\/$/, "") + "/rest"; }

  private async post(path: string, body: unknown): Promise<Record<string, any>> {
    const res = await fetch(this.base() + path, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`twenty_post_${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return (await res.json()) as Record<string, any>;
  }
  private async get(path: string): Promise<Record<string, any>> {
    const res = await fetch(this.base() + path, { headers: this.headers() });
    if (!res.ok) throw new Error(`twenty_get_${res.status}`);
    return (await res.json()) as Record<string, any>;
  }
  private firstId(list: Record<string, any>): string | undefined {
    const arr = list?.data ?? [];
    const first = Array.isArray(arr) ? arr[0] : (Array.isArray(arr && Object.values(arr)[0]) ? (Object.values(arr)[0] as any[])[0] : undefined);
    return first?.id;
  }

  async findOrCreateCompany(input: { name?: string; domainName?: string }): Promise<{ id: string }> {
    if (input.name) {
      const found = await this.get(`/companies?filter=name[eq]:${encodeURIComponent(input.name)}&limit=1`).catch(() => ({}));
      const id = this.firstId(found);
      if (id) return { id };
    }
    const created = await this.post(`/companies`, { name: input.name ?? "Unknown", ...(input.domainName ? { domainName: { primaryLinkUrl: input.domainName } } : {}) });
    return { id: created.data?.createCompany?.id ?? created.data?.id };
  }

  async findOrCreatePerson(input: { email?: string; name?: string; phone?: string; companyId?: string }): Promise<{ id: string }> {
    if (input.email) {
      const found = await this.get(`/people?filter=emails.primaryEmail[eq]:${encodeURIComponent(input.email)}&limit=1`).catch(() => ({}));
      const id = this.firstId(found);
      if (id) return { id };
    }
    const [firstName, ...rest] = (input.name ?? "").split(" ");
    const created = await this.post(`/people`, {
      name: { firstName: firstName || "Lead", lastName: rest.join(" ") },
      ...(input.email ? { emails: { primaryEmail: input.email } } : {}),
      ...(input.phone ? { phones: { primaryPhoneNumber: input.phone } } : {}),
      ...(input.companyId ? { companyId: input.companyId } : {}),
    });
    return { id: created.data?.createPerson?.id ?? created.data?.id };
  }

  async createOpportunity(input: { name: string; stage: string; companyId?: string; pointOfContactId?: string; amountMicros?: number; currencyCode?: string }): Promise<{ id: string }> {
    const created = await this.post(`/opportunities`, {
      name: input.name, stage: input.stage,
      ...(input.companyId ? { companyId: input.companyId } : {}),
      ...(input.pointOfContactId ? { pointOfContactId: input.pointOfContactId } : {}),
      ...(input.amountMicros != null ? { amount: { amountMicros: input.amountMicros, currencyCode: input.currencyCode ?? "EUR" } } : {}),
    });
    return { id: created.data?.createOpportunity?.id ?? created.data?.id };
  }

  async getOpportunity(id: string): Promise<{ id: string; stage?: string; amountMicros?: number }> {
    const r = await this.get(`/opportunities/${id}`);
    const o = r.data?.opportunity ?? r.data ?? r;
    return { id, stage: o?.stage, amountMicros: o?.amount?.amountMicros };
  }
}
