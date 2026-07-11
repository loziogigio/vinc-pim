import type { AnalyticsConfig, Properties, Traits } from './types.js';
import type { EventName } from './events.js';
export declare function initAnalytics(cfg: AnalyticsConfig): Promise<void>;
export declare function track(event: EventName | string, properties?: Properties): void;
export declare function identify(id: string, traits?: Traits): void;
export declare function page(properties?: Properties): void;
/** Clear identity. Used on consent withdrawal — also drops the anonymousId cookie. */
export declare function reset(): void;
export declare function getAnonymousId(): string | undefined;
export declare function isReady(): boolean;
//# sourceMappingURL=analytics.d.ts.map