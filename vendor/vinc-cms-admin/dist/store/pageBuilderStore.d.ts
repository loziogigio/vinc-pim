import type { PageBlock, BlockConfig, PageConfig } from "../types.js";
export type DeviceMode = "desktop" | "tablet" | "mobile";
interface PageBuilderState {
    blocks: PageBlock[];
    selectedBlockId: string | null;
    isDirty: boolean;
    history: {
        past: Array<{
            blocks: PageBlock[];
            selectedBlockId: string | null;
        }>;
        future: Array<{
            blocks: PageBlock[];
            selectedBlockId: string | null;
        }>;
    };
    pageDetails: {
        slug: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        seo?: any;
    };
    currentVersion: number;
    currentPublishedVersion?: number;
    versions: PageConfig["versions"];
    loadPageConfig: (config: PageConfig) => void;
    addBlock: (variantId: string) => void;
    removeBlock: (blockId: string) => void;
    duplicateBlock: (blockId: string) => void;
    reorderBlocks: (fromIndex: number, toIndex: number) => void;
    updateBlockConfig: (blockId: string, config: Partial<BlockConfig>) => void;
    selectBlock: (blockId: string | null) => void;
    undo: () => void;
    redo: () => void;
    markSaved: () => void;
    getPagePayload: () => {
        slug: string;
        blocks: PageBlock[];
        seo?: any;
    };
}
export declare const usePageBuilderStore: import("zustand").UseBoundStore<import("zustand").StoreApi<PageBuilderState>>;
export {};
//# sourceMappingURL=pageBuilderStore.d.ts.map