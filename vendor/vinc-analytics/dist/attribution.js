/** Map raw source/medium/click-ids to a BI channel. Deterministic, order matters. */
export function channelOf(source, medium, gclid, fbclid, li_fat_id = '') {
    const s = source.toLowerCase();
    const m = medium.toLowerCase();
    if (gclid || m === 'cpc' || m === 'ppc' || m === 'paidsearch' || m === 'paid_search')
        return 'paid_search';
    if (li_fat_id)
        return 'paid_social'; // LinkedIn paid (click id present)
    if (fbclid || m === 'paid_social' || m === 'paidsocial' || m === 'cpc_social')
        return 'paid_social';
    if (m === 'offline')
        return 'offline';
    if (m === 'email' || s === 'email' || s === 'newsletter')
        return 'email';
    const socialSources = ['facebook', 'instagram', 'linkedin', 'twitter', 'x', 'tiktok', 'youtube'];
    if (m === 'social' || m === 'social-media' || m === 'social-network' || socialSources.includes(s))
        return 'organic_social';
    if (m === 'referral')
        return 'referral';
    if (source || medium)
        return 'referral'; // tagged but uncategorised → treat as referral
    return 'direct';
}
/** Parse a landing URL + referrer into a single attribution touch. Pure. */
export function parseAttribution(href, referrer, nowIso) {
    const url = new URL(href);
    const q = (k) => url.searchParams.get(k) ?? '';
    const gclid = q('gclid');
    const fbclid = q('fbclid');
    const li_fat_id = q('li_fat_id');
    const msclkid = q('msclkid');
    const fbc = fbclid ? 'fb.1.' + Date.parse(nowIso) + '.' + fbclid : '';
    let source = q('utm_source');
    let medium = q('utm_medium');
    const campaign = q('utm_campaign');
    const term = q('utm_term');
    const content = q('utm_content');
    if (!source && gclid)
        source = 'google';
    if (!medium && gclid)
        medium = 'cpc';
    if (!source && fbclid)
        source = 'facebook';
    if (!medium && fbclid)
        medium = 'paid_social';
    if (!source && referrer) {
        try {
            const r = new URL(referrer);
            if (r.hostname && r.hostname !== url.hostname) {
                source = r.hostname;
                medium = medium || 'referral';
            }
        }
        catch {
            /* malformed referrer — ignore */
        }
    }
    return {
        source,
        medium,
        campaign,
        term,
        content,
        gclid,
        fbclid,
        li_fat_id,
        msclkid,
        fbc,
        channel: channelOf(source, medium, gclid, fbclid, li_fat_id),
        landing_page: url.pathname,
        referrer,
        ts: nowIso,
    };
}
/**
 * Reduce a stored {first,last} + the current touch into the new stored value.
 * first-touch is immutable once set; last-touch advances on any non-direct touch.
 */
export function resolveTouches(stored, current) {
    const first = stored?.first ?? current;
    const last = !stored || current.channel !== 'direct' ? current : stored.last;
    return { first, last };
}
//# sourceMappingURL=attribution.js.map