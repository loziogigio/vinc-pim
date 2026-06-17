'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track as _track, identify as _identify, getAnonymousId as _getAnonymousId, page as _page } from './analytics.js';
const Ctx = createContext({
    track: _track,
    identify: _identify,
    getAnonymousId: _getAnonymousId,
});
export function AnalyticsProvider({ children }) {
    return (_jsx(Ctx.Provider, { value: { track: _track, identify: _identify, getAnonymousId: _getAnonymousId }, children: children }));
}
export function useAnalytics() {
    return useContext(Ctx);
}
/** Fires a page() event on every App-Router pathname change. Renders nothing. */
export function PageTracker() {
    const pathname = usePathname();
    const last = useRef(null);
    useEffect(() => {
        if (pathname && pathname !== last.current) {
            last.current = pathname;
            _page({ path: pathname });
        }
    }, [pathname]);
    return null;
}
//# sourceMappingURL=react.js.map