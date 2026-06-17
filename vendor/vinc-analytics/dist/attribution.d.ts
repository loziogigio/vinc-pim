import type { Channel, StoredTouches, TouchAttribution } from './types.js';
/** Map raw source/medium/click-ids to a BI channel. Deterministic, order matters. */
export declare function channelOf(source: string, medium: string, gclid: string, fbclid: string, li_fat_id?: string): Channel;
/** Parse a landing URL + referrer into a single attribution touch. Pure. */
export declare function parseAttribution(href: string, referrer: string, nowIso: string): TouchAttribution;
/**
 * Reduce a stored {first,last} + the current touch into the new stored value.
 * first-touch is immutable once set; last-touch advances on any non-direct touch.
 */
export declare function resolveTouches(stored: StoredTouches | null, current: TouchAttribution): StoredTouches;
//# sourceMappingURL=attribution.d.ts.map