import { parseAttribution, resolveTouches } from './attribution.js';
import { getCookie, setCookie } from './cookies.js';
const COOKIE = 'va_attribution';
const MAX_AGE_DAYS = 180;
/**
 * Read stored touches, fold in the current landing, persist, and return the
 * resolved {first,last}. Safe to call on every page load. Browser only.
 */
export function captureAttribution(cookieDomain) {
    const raw = getCookie(COOKIE);
    let stored = null;
    if (raw) {
        try {
            stored = JSON.parse(raw);
        }
        catch {
            stored = null;
        }
    }
    const current = parseAttribution(location.href, document.referrer, new Date().toISOString());
    const resolved = resolveTouches(stored, current);
    setCookie(COOKIE, JSON.stringify(resolved), { days: MAX_AGE_DAYS, domain: cookieDomain });
    return resolved;
}
//# sourceMappingURL=attribution-browser.js.map