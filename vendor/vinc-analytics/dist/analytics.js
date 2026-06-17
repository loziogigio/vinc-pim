import { getCookie, setCookie, deleteCookie } from './cookies.js';
/**
 * First-party browser transport for the self-hosted RudderStack data plane.
 *
 * We deliberately do NOT use the @rudderstack/analytics-js SDK: it requires a
 * source-config fetch from a control plane, which the self-hosted deployment does
 * not run (the data plane has no /sourceConfig endpoint). Instead we POST events
 * straight to the data plane's HTTP API (the same path the server uses) with the
 * writeKey as HTTP Basic auth, and manage the anonymousId ourselves in a
 * first-party cookie. Cloud-mode destinations (GA4/Facebook/Ads, phase 2) are
 * configured server-side in rudder-server and are unaffected by how the browser
 * delivers events.
 */
const ANON_COOKIE = 'va_anonymous_id';
const ANON_MAX_AGE_DAYS = 730; // ~2 years
let config = null;
let userId = null;
// In-memory mirror of the anonymousId: keeps a stable id for the session even when
// the cookie cannot persist (e.g. a Domain that doesn't match the current host).
let anonId = null;
function uuid() {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c?.randomUUID)
        return c.randomUUID();
    const b = c?.getRandomValues
        ? c.getRandomValues(new Uint8Array(16))
        : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
function ensureAnonymousId(domain) {
    if (anonId)
        return anonId;
    let id = getCookie(ANON_COOKIE);
    if (!id) {
        id = uuid();
        setCookie(ANON_COOKIE, id, { days: ANON_MAX_AGE_DAYS, domain });
    }
    anonId = id;
    return id;
}
function currentAnonId() {
    return anonId ?? getCookie(ANON_COOKIE) ?? undefined;
}
/**
 * Initialise the transport. Call ONLY after analytics consent is granted. Ensures
 * an anonymousId exists. Async to keep a stable signature for callers.
 */
const MAX_PRE_INIT = 100;
const preInit = [];
/**
 * Send if initialised, else buffer. PageTracker's first page() can fire before the
 * consent effect calls initAnalytics (child effects run before the parent's), so we
 * buffer pre-init events and flush them on init — mirroring the SDK's preload buffer.
 */
function dispatch(path, payload) {
    if (config)
        send(path, payload);
    else if (preInit.length < MAX_PRE_INIT)
        preInit.push({ path, payload });
}
export async function initAnalytics(cfg) {
    if (config)
        return;
    config = cfg;
    if (typeof document !== 'undefined')
        ensureAnonymousId(cfg.cookieDomain);
    for (const e of preInit.splice(0))
        send(e.path, e.payload);
}
function context() {
    // analytics is always true here: the transport only initialises after analytics consent.
    const consent = { analytics: true, marketing: Boolean(config && config.marketingConsent) };
    if (typeof window === 'undefined')
        return { consent, library: { name: 'vinc-analytics' } };
    return {
        page: {
            path: window.location.pathname,
            url: window.location.href,
            search: window.location.search,
            referrer: typeof document !== 'undefined' ? document.referrer : '',
            title: typeof document !== 'undefined' ? document.title : '',
        },
        locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        consent,
        library: { name: 'vinc-analytics' },
    };
}
function send(path, payload) {
    if (!config)
        return;
    const now = new Date().toISOString();
    const body = JSON.stringify({
        ...payload,
        anonymousId: currentAnonId(),
        userId: userId ?? undefined,
        context: context(),
        messageId: uuid(),
        originalTimestamp: now,
        sentAt: now,
    });
    try {
        void fetch(config.dataPlaneUrl.replace(/\/$/, '') + path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Basic ' + btoa(`${config.writeKey}:`),
            },
            body,
            keepalive: true,
        }).catch(() => {
            /* analytics delivery is best-effort; never surface to the user */
        });
    }
    catch {
        /* never throw from a tracking call */
    }
}
export function track(event, properties) {
    dispatch('/v1/track', { type: 'track', event, properties: properties ?? {} });
}
export function identify(id, traits) {
    userId = id;
    dispatch('/v1/identify', { type: 'identify', traits: traits ?? {} });
}
export function page(properties) {
    dispatch('/v1/page', { type: 'page', properties: properties ?? {} });
}
/** Clear identity. Used on consent withdrawal — also drops the anonymousId cookie. */
export function reset() {
    userId = null;
    anonId = null;
    if (config)
        deleteCookie(ANON_COOKIE, config.cookieDomain);
}
export function getAnonymousId() {
    if (!config)
        return undefined;
    return currentAnonId();
}
export function isReady() {
    return config !== null;
}
//# sourceMappingURL=analytics.js.map