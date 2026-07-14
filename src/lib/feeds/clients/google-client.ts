/**
 * Google Merchant API client — service-account JWT auth (jose, RS256) +
 * per-item productInputs insert/delete with error capture. Endpoints are
 * env-overridable for tests and future API-version bumps.
 */
import { SignJWT, importPKCS8 } from "jose";
import type { FeedProduct } from "../canonical";
import { toGoogleProductInput, googleOfferId } from "../adapters/google";

const TOKEN_URL =
  process.env.FEEDS_GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const API_BASE =
  process.env.FEEDS_GOOGLE_API_BASE || "https://merchantapi.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/content";
const CHUNK_SIZE = 25;

export interface FeedPushResult {
  entity_code: string;
  ok: boolean;
  error?: string;
}

export interface GoogleClientConfig {
  merchantAccountId: string;
  serviceAccountJson: string;
  contentLanguage: string;
  feedLabel: string;
}

export class GoogleMerchantClient {
  private cfg: GoogleClientConfig;
  private token: { value: string; expiresAt: number } | null = null;
  // In-flight token exchange, shared by concurrent callers (perItem() runs a
  // chunk's requests via Promise.all) so a race never fires duplicate token
  // exchanges before the first one has a chance to populate the cache.
  private tokenPromise: Promise<string> | null = null;

  constructor(cfg: GoogleClientConfig) {
    this.cfg = cfg;
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.value;
    }
    if (!this.tokenPromise) {
      this.tokenPromise = this.fetchToken().finally(() => {
        this.tokenPromise = null;
      });
    }
    return this.tokenPromise;
  }

  private async fetchToken(): Promise<string> {
    const sa = JSON.parse(this.cfg.serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };
    const key = await importPKCS8(sa.private_key, "RS256");
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(sa.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) {
      throw new Error(`Google token exchange failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return this.token.value;
  }

  private async authedFetch(url: string, init: RequestInit): Promise<Response> {
    const token = await this.getToken();
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  private async perItem(
    codes: string[],
    doOne: (code: string) => Promise<Response>
  ): Promise<FeedPushResult[]> {
    const results: FeedPushResult[] = [];
    for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
      const chunk = codes.slice(i, i + CHUNK_SIZE);
      const settled = await Promise.all(
        chunk.map(async (code): Promise<FeedPushResult> => {
          try {
            const res = await doOne(code);
            if (res.ok) return { entity_code: code, ok: true };
            const text = await res.text();
            return {
              entity_code: code,
              ok: false,
              error: `HTTP ${res.status}: ${text.slice(0, 500)}`,
            };
          } catch (err) {
            return {
              entity_code: code,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        })
      );
      results.push(...settled);
    }
    return results;
  }

  async pushProducts(products: FeedProduct[]): Promise<FeedPushResult[]> {
    const byCode = new Map(products.map((p) => [p.entity_code, p]));
    const url = `${API_BASE}/products/v1/accounts/${this.cfg.merchantAccountId}/productInputs:insert`;
    return this.perItem([...byCode.keys()], (code) =>
      this.authedFetch(url, {
        method: "POST",
        body: JSON.stringify(
          toGoogleProductInput(byCode.get(code)!, {
            contentLanguage: this.cfg.contentLanguage,
            feedLabel: this.cfg.feedLabel,
          })
        ),
      })
    );
  }

  async deleteProducts(entityCodes: string[]): Promise<FeedPushResult[]> {
    return this.perItem(entityCodes, (code) => {
      const name = `ONLINE~${this.cfg.contentLanguage}~${this.cfg.feedLabel}~${code}`;
      const url = `${API_BASE}/products/v1/accounts/${this.cfg.merchantAccountId}/productInputs/${encodeURIComponent(name)}`;
      return this.authedFetch(url, { method: "DELETE" });
    });
  }
}
