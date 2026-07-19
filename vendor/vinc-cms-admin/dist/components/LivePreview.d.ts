import type { PageBlock } from "../types.js";
import type { DeviceMode } from "../store/pageBuilderStore.js";
type LivePreviewProps = {
    device: DeviceMode;
    blocks: PageBlock[];
    productId?: string;
    pageType?: "home" | "product";
    pageSlug?: string;
    customerWebUrl?: string;
    previewUrl?: string;
    isDirty?: boolean;
};
export declare const LivePreview: ({ device, blocks, productId, pageType, pageSlug, customerWebUrl, previewUrl, isDirty }: LivePreviewProps) => import("react").JSX.Element;
export {};
//# sourceMappingURL=LivePreview.d.ts.map