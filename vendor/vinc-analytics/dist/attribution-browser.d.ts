import type { StoredTouches } from './types.js';
/**
 * Read stored touches, fold in the current landing, persist, and return the
 * resolved {first,last}. Safe to call on every page load. Browser only.
 */
export declare function captureAttribution(cookieDomain?: string): StoredTouches;
//# sourceMappingURL=attribution-browser.d.ts.map