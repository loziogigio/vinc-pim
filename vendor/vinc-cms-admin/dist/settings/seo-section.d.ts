import type { IB2CStorefrontMetaTags } from "./types.js";
import type { IB2BPortalSeoConfig } from "./types.js";
export declare function SeoSection({ metaTags, onChange, channelSeo, onChannelSeoChange, languages, saving, onSave, }: {
    metaTags: IB2CStorefrontMetaTags;
    onChange: (key: keyof IB2CStorefrontMetaTags, value: string) => void;
    /** B2B-only URL/robots settings. Omit the change callback on B2C screens. */
    channelSeo?: IB2BPortalSeoConfig;
    onChannelSeoChange?: (value: IB2BPortalSeoConfig) => void;
    languages?: Array<{
        code: string;
        name: string;
        nativeName?: string;
    }>;
    saving: boolean;
    onSave: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=seo-section.d.ts.map