import type { PageBlock, PageConfig, PageSEOSettings } from './types.js';
export interface PageItem {
    _id: string;
    slug: string;
    title: string;
    status: 'active' | 'inactive';
    show_in_nav: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    template_status?: 'draft' | 'published';
    last_saved_at?: string | null;
    published_at?: string | null;
    has_unpublished_changes?: boolean;
}
export interface PublishHomePayload {
    version: number;
    campaign: string | null;
    segment: string | null;
    attributes: {
        region: string | null;
        language: string | null;
        device: string | null;
        addressStates?: string[];
    };
    priority: number;
    isDefault: boolean;
    activeFrom: string | null;
    activeTo: string | null;
    comment: string | null;
}
export interface CmsAdminClientConfig {
    /** Host-relative base for one storefront, e.g. "/api/b2b/b2c/storefronts/simani"
     *  (CS) or "/api/storefront/cms/my-store" (office proxy). */
    apiBase: string;
    fetchInit?: RequestInit;
}
export declare class CmsAdminError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare class CmsAdminClient {
    private readonly cfg;
    constructor(cfg: CmsAdminClientConfig);
    private request;
    listPages(): Promise<PageItem[]>;
    createPage(input: {
        title: string;
        slug: string;
    }): Promise<void>;
    renamePage(pageSlug: string, input: {
        title: string;
        slug?: string;
    }): Promise<void>;
    deletePage(pageSlug: string): Promise<void>;
    duplicatePage(pageSlug: string): Promise<{
        slug: string;
    }>;
    getPageTemplate(pageSlug: string): Promise<PageConfig>;
    savePageDraft(pageSlug: string, payload: {
        blocks: PageBlock[];
        seo?: PageSEOSettings;
    }): Promise<PageConfig>;
    publishPage(pageSlug: string): Promise<PageConfig>;
    getHomeTemplate(version?: number): Promise<PageConfig>;
    saveHomeDraft(payload: {
        blocks: PageBlock[];
        seo?: PageSEOSettings;
    }): Promise<PageConfig>;
    publishHome(payload: PublishHomePayload): Promise<PageConfig>;
    startNewHomeVersion(): Promise<PageConfig>;
    loadHomeVersion(version: number): Promise<PageConfig>;
    deleteHomeVersion(version: number): Promise<PageConfig>;
    duplicateHomeVersion(version: number): Promise<PageConfig>;
    renameHomeVersion(version: number, label: string): Promise<PageConfig>;
    unpublishHomeVersion(version: number): Promise<PageConfig>;
}
//# sourceMappingURL=client.d.ts.map