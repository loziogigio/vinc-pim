import type { Properties, ServerAnalyticsConfig, Traits } from './types.js';
export declare function serverTrack(cfg: ServerAnalyticsConfig, input: {
    event: string;
    userId?: string;
    anonymousId?: string;
    properties?: Properties;
    context?: Record<string, unknown>;
}): Promise<boolean>;
export declare function serverIdentify(cfg: ServerAnalyticsConfig, input: {
    userId?: string;
    anonymousId?: string;
    traits?: Traits;
    context?: Record<string, unknown>;
}): Promise<boolean>;
//# sourceMappingURL=server.d.ts.map