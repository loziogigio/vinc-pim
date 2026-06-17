/**
 * Minimal first-party cookie helpers (browser-only; SSR-safe no-ops on the server).
 * Shared by the analytics transport (anonymousId) and attribution capture.
 */
export declare function getCookie(name: string): string | null;
export declare function setCookie(name: string, value: string, opts?: {
    days?: number;
    domain?: string;
}): void;
export declare function deleteCookie(name: string, domain?: string): void;
//# sourceMappingURL=cookies.d.ts.map