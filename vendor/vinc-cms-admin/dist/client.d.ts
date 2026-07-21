import type { PageBlock, PageConfig, PageSEOSettings } from './types.js';
import type { IB2CStorefrontMetaTags, IB2CCustomScript } from './settings/types.js';
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
/** Storefront record shape returned by GET/PATCH {apiBase} — the settings screen
 *  only ever reads/writes meta_tags/custom_scripts/custom_css from it, but the
 *  server may return other fields (name, slug, channel, domains, ...). */
export interface StorefrontSettingsRecord {
    name?: string;
    slug?: string;
    meta_tags?: IB2CStorefrontMetaTags;
    custom_scripts?: IB2CCustomScript[];
    custom_css?: string;
    [key: string]: unknown;
}
export declare class CmsAdminClient {
    /** Host-relative base for one storefront, e.g. "/api/b2b/b2c/storefronts/simani". */
    readonly apiBase: string;
    private readonly fetchInit?;
    constructor(cfg: CmsAdminClientConfig);
    private request;
    /** GET {apiBase} — the storefront's own settings record (name/slug/meta_tags/
     *  custom_scripts/custom_css/...). Unwraps {success,data}. */
    getStorefront(): Promise<StorefrontSettingsRecord>;
    /** PATCH {apiBase} with exactly the given partial record. Callers are expected to
     *  send only the fields they own (the settings screen sends meta_tags/custom_scripts/
     *  custom_css — never name/channel/domains, which are the office security contract). */
    updateStorefront(patch: Partial<StorefrontSettingsRecord>): Promise<StorefrontSettingsRecord>;
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