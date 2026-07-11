import type { Properties, Traits } from './types.js';
import type { EventName } from './events.js';
interface AnalyticsApi {
    track: (event: EventName | string, properties?: Properties) => void;
    identify: (userId: string, traits?: Traits) => void;
    getAnonymousId: () => string | undefined;
}
export declare function AnalyticsProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useAnalytics(): AnalyticsApi;
/** Fires a page() event on every App-Router pathname change. Renders nothing. */
export declare function PageTracker(): null;
export {};
//# sourceMappingURL=react.d.ts.map