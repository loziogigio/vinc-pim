/**
 * Minimal first-party cookie helpers (browser-only; SSR-safe no-ops on the server).
 * Shared by the analytics transport (anonymousId) and attribution capture.
 */
export function getCookie(name) {
    if (typeof document === 'undefined')
        return null;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
}
export function setCookie(name, value, opts = {}) {
    if (typeof document === 'undefined')
        return;
    let c = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
    if (opts.days)
        c += `; Max-Age=${opts.days * 24 * 60 * 60}`;
    if (opts.domain)
        c += `; Domain=${opts.domain}`;
    if (typeof location !== 'undefined' && location.protocol === 'https:')
        c += '; Secure';
    document.cookie = c;
}
export function deleteCookie(name, domain) {
    if (typeof document === 'undefined')
        return;
    let c = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    if (domain)
        c += `; Domain=${domain}`;
    document.cookie = c;
}
//# sourceMappingURL=cookies.js.map