import { create } from "zustand";
import { nanoid } from "nanoid";
import { getBlockTemplate } from "@/lib/config/blockTemplates";
import type { PageBlock, BlockConfig, PageConfig } from "@/lib/types/blocks";

export type DeviceMode = "desktop" | "tablet" | "mobile";

interface PageBuilderState {
  blocks: PageBlock[];
  selectedBlockId: string | null;
  isDirty: boolean;
  history: {
    past: Array<{ blocks: PageBlock[]; selectedBlockId: string | null }>;
    future: Array<{ blocks: PageBlock[]; selectedBlockId: string | null }>;
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
  getPagePayload: () => { slug: string; blocks: PageBlock[]; seo?: any };
}

const cloneBlocks = (blocks: PageBlock[]): PageBlock[] =>
  JSON.parse(JSON.stringify(blocks)) as PageBlock[];

export const usePageBuilderStore = create<PageBuilderState>((set, get) => ({
  blocks: [],
  selectedBlockId: null,
  isDirty: false,
  history: {
    past: [],
    future: []
  },
  pageDetails: {
    slug: "home",
    name: "Homepage",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seo: undefined
  },
  currentVersion: 0,
  currentPublishedVersion: undefined,
  versions: [],
  loadPageConfig: (config) => {
    // Get current working version by currentVersion number, not last in array
    const currentVersionData = config.versions.find(v => v.version === config.currentVersion)
      || config.versions[config.versions.length - 1]; // Fallback to last if not found
    const blocks = currentVersionData?.blocks || [];
    const seo = currentVersionData?.seo;

    set({
      blocks: [...blocks].sort((a, b) => a.order - b.order),
      selectedBlockId: null,
      isDirty: false,
      history: { past: [], future: [] },
      pageDetails: {
        slug: config.slug,
        name: config.name,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        seo
      },
      currentVersion: config.currentVersion,
      currentPublishedVersion: config.currentPublishedVersion,
      versions: config.versions
    });
  },
  addBlock: (variantId) => {
    const template = getBlockTemplate(variantId);
    if (!template) return;

    const newBlock: PageBlock = {
      id: nanoid(),
      type: variantId,
      order: get().blocks.length,
      config: template.defaultConfig,
      metadata: { templateVersion: "1.0", createdAt: new Date().toISOString() }
    };

    set((state) => ({
      blocks: [...state.blocks, newBlock],
      selectedBlockId: newBlock.id,
      isDirty: true,
      history: {
        past: [
          ...state.history.past.slice(-19),
          { blocks: cloneBlocks(state.blocks), selectedBlockId: state.selectedBlockId }
        ],
        future: []
      }
    }));
  },
  removeBlock: (blockId) => {
    set((state) => ({
      blocks: state.blocks
        .filter((block) => block.id !== blockId)
        .map((block, index) => ({ ...block, order: index })),
      selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
      isDirty: true,
      history: {
        past: [
          ...state.history.past.slice(-19),
          { blocks: cloneBlocks(state.blocks), selectedBlockId: state.selectedBlockId }
        ],
        future: []
      }
    }));
  },
  duplicateBlock: (blockId) => {
    const source = get().blocks.find((block) => block.id === blockId);
    if (!source) return;

    const clonedConfig = JSON.parse(JSON.stringify(source.config)) as BlockConfig;
    const newBlock: PageBlock = {
      ...source,
      id: nanoid(),
      order: get().blocks.length,
      config: clonedConfig,
      metadata: {
        ...source.metadata,
        clonedFrom: source.id,
        createdAt: new Date().toISOString()
      }
    };

    set((state) => ({
      blocks: [...state.blocks, newBlock],
      selectedBlockId: newBlock.id,
      isDirty: true,
      history: {
        past: [
          ...state.history.past.slice(-19),
          { blocks: cloneBlocks(state.blocks), selectedBlockId: state.selectedBlockId }
        ],
        future: []
      }
    }));
  },
  reorderBlocks: (fromIndex, toIndex) => {
    const blocks = [...get().blocks];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    const normalized = blocks.map((block, index) => ({ ...block, order: index }));
    set((state) => ({
      blocks: normalized,
      isDirty: true,
      history: {
        past: [
          ...state.history.past.slice(-19),
          { blocks: cloneBlocks(state.blocks), selectedBlockId: state.selectedBlockId }
        ],
        future: []
      }
    }));
  },
  updateBlockConfig: (blockId, config) => {
    set((state) => ({
      blocks: state.blocks.map((block) =>
        block.id === blockId ? { ...block, config: { ...block.config, ...config } as BlockConfig } : block
      ),
      isDirty: true,
      history: {
        past: [
          ...state.history.past.slice(-19),
          { blocks: cloneBlocks(state.blocks), selectedBlockId: state.selectedBlockId }
        ],
        future: []
      }
    }));
  },
  selectBlock: (blockId) => set({ selectedBlockId: blockId }),
  undo: () =>
    set((state) => {
      if (state.history.past.length === 0) {
        return {};
      }
      const previous = state.history.past[state.history.past.length - 1];
      const remainingPast = state.history.past.slice(0, -1);
      const currentSnapshot = {
        blocks: cloneBlocks(state.blocks),
        selectedBlockId: state.selectedBlockId
      };
      return {
        blocks: cloneBlocks(previous.blocks),
        selectedBlockId: previous.selectedBlockId,
        history: {
          past: remainingPast,
          future: [currentSnapshot, ...state.history.future]
        },
        isDirty: true
      };
    }),
  redo: () =>
    set((state) => {
      if (state.history.future.length === 0) {
        return {};
      }
      const [next, ...restFuture] = state.history.future;
      const currentSnapshot = {
        blocks: cloneBlocks(state.blocks),
        selectedBlockId: state.selectedBlockId
      };
      return {
        blocks: cloneBlocks(next.blocks),
        selectedBlockId: next.selectedBlockId,
        history: {
          past: [...state.history.past, currentSnapshot].slice(-20),
          future: restFuture
        },
        isDirty: true
      };
    }),
  markSaved: () => set({ isDirty: false }),
  getPagePayload: () => {
    const state = get();
    return {
      slug: state.pageDetails.slug,
      blocks: state.blocks.map((block, index) => ({
        ...block,
        order: index
      })),
      seo: state.pageDetails.seo
    };
  }
}));
