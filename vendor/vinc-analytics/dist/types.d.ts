/** Channels we group acquisition/conversion into for BI. */
export type Channel = 'paid_search' | 'paid_social' | 'organic_social' | 'email' | 'referral' | 'offline' | 'direct';
/** A single attribution touch (acquisition or conversion). */
export interface TouchAttribution {
    source: string;
    medium: string;
    campaign: string;
    term: string;
    content: string;
    gclid: string;
    fbclid: string;
    /** LinkedIn click id. */
    li_fat_id: string;
    /** Microsoft (Bing) click id. */
    msclkid: string;
    /** Meta click id cookie value derived from fbclid (fb.1.<ts>.<fbclid>). */
    fbc: string;
    channel: Channel;
    landing_page: string;
    referrer: string;
    /** ISO timestamp. */
    ts: string;
}
/** Consent state for the two cookie categories we gate destinations on. */
export type Consent = {
    analytics: boolean;
    marketing: boolean;
};
/** Persisted first-touch (acquisition) + last-touch (conversion). */
export interface StoredTouches {
    first: TouchAttribution;
    last: TouchAttribution;
}
export type Properties = Record<string, unknown>;
export type Traits = Record<string, unknown>;
/** Browser SDK init config. */
export interface AnalyticsConfig {
    writeKey: string;
    dataPlaneUrl: string;
    /** Cookie domain for cross-subdomain anonymousId, e.g. ".vendereincloud.it". */
    cookieDomain?: string;
    /** Whether marketing-category consent was granted (gates marketing destinations later). */
    marketingConsent?: boolean;
}
/** Server-side (Node) config for the HTTP API. */
export interface ServerAnalyticsConfig {
    writeKey: string;
    dataPlaneUrl: string;
}
//# sourceMappingURL=types.d.ts.map