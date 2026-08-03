import type { PageBlock, PageConfig, PageSEOSettings, FormBlockConfig } from './types.js';
import type { IB2CStorefrontMetaTags, IB2CCustomScript } from './settings/types.js';
import type { BlogPostListItem, BlogTaxonomyItem } from './blog/types.js';
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
    /** Machine-readable error code from the server body, e.g. "NOT_MIGRATED",
     *  "EXPORT_TOO_LARGE". Hosts branch on this instead of parsing messages. */
    code?: string;
    /** Remaining fields from the error body (e.g. { total, max }). */
    details?: Record<string, unknown>;
    constructor(status: number, message: string, code?: string, details?: Record<string, unknown>);
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
/** Server-side pagination envelope shared by the submissions/definitions list endpoints. */
export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface FormSubmissionRecord {
    _id: string;
    /** Present on B2C storefront submissions. */
    storefront_slug?: string;
    /** Present on B2B portal submissions. */
    portal_slug?: string;
    page_slug?: string;
    form_block_id?: string;
    form_type?: 'page_form' | 'standalone';
    form_definition_slug?: string;
    order_id?: string;
    data: Record<string, unknown>;
    submitter_email?: string;
    ip_address?: string;
    seen: boolean;
    created_at: string;
}
export interface FormDefinitionRecord {
    _id: string;
    storefront_slug: string;
    slug: string;
    name: string;
    config: FormBlockConfig;
    notification_emails: string[];
    send_submitter_copy: boolean;
    is_system: boolean;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface FormDefinitionInput {
    name: string;
    slug?: string;
    config: FormBlockConfig;
    notification_emails: string[];
    send_submitter_copy: boolean;
    enabled: boolean;
}
/** Full blog-post record returned by GET/PATCH {apiBase}/blog/posts/{id}. Broader than
 *  BlogPostListItem (per-locale translations, channels, taxonomy ids, …); callers read
 *  only the fields they need, so the shape is left open. */
export interface BlogPostRecord {
    post_id: string;
    slug: string;
    channels: string[];
    [key: string]: unknown;
}
/** Blog content template for one post + locale. Same PageConfig the builder store loads
 *  (the content routes return it un-enveloped, exactly like the page/home template routes). */
export type BlogContentConfig = PageConfig;
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
    listSubmissions(params?: {
        page?: number;
        limit?: number;
        form_type?: string;
        ip?: string;
        page_slug?: string;
        email?: string;
        seen?: 'seen' | 'unseen';
        date_from?: string;
        date_to?: string;
    }): Promise<{
        items: FormSubmissionRecord[];
        pagination: Pagination;
    }>;
    /** POSTs an export request and resolves the CSV blob. Cannot use `request`,
     *  which always parses JSON. */
    exportSubmissions(body: {
        submission_ids?: string[];
        all_matching?: boolean;
        filters?: Record<string, unknown>;
        delimiter?: 'comma' | 'semicolon';
    }): Promise<Blob>;
    getSubmission(id: string): Promise<FormSubmissionRecord>;
    setSubmissionSeen(id: string, seen: boolean): Promise<FormSubmissionRecord>;
    deleteSubmission(id: string): Promise<void>;
    listFormDefinitions(params?: {
        page?: number;
        limit?: number;
    }): Promise<{
        items: FormDefinitionRecord[];
        pagination: Pagination;
    }>;
    createFormDefinition(input: FormDefinitionInput): Promise<FormDefinitionRecord>;
    updateFormDefinition(slug: string, input: Partial<FormDefinitionInput>): Promise<FormDefinitionRecord>;
    deleteFormDefinition(slug: string): Promise<void>;
    listBlogPosts(params?: {
        locale?: string;
        status?: string;
        category?: string;
        tag?: string;
        q?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: BlogPostListItem[];
        pagination: Pagination;
    }>;
    createBlogPost(input: {
        title: string;
        slug?: string;
        default_locale?: string;
    }): Promise<{
        post_id: string;
        slug: string;
    }>;
    getBlogPost(postId: string): Promise<BlogPostRecord>;
    updateBlogPost(postId: string, patch: Record<string, unknown>): Promise<BlogPostRecord>;
    deleteBlogPost(postId: string): Promise<void>;
    getBlogContent(postId: string, locale: string): Promise<BlogContentConfig>;
    saveBlogDraft(postId: string, locale: string, payload: {
        blocks: PageBlock[];
        seo?: PageSEOSettings;
    }): Promise<BlogContentConfig>;
    publishBlogContent(postId: string, locale: string, options?: {
        scheduled_at?: string;
    }): Promise<BlogContentConfig>;
    listBlogCategories(): Promise<BlogTaxonomyItem[]>;
    createBlogCategory(input: Record<string, unknown>): Promise<BlogTaxonomyItem>;
    updateBlogCategory(id: string, patch: Record<string, unknown>): Promise<BlogTaxonomyItem>;
    deleteBlogCategory(id: string): Promise<void>;
    listBlogTags(): Promise<BlogTaxonomyItem[]>;
    createBlogTag(input: Record<string, unknown>): Promise<BlogTaxonomyItem>;
    updateBlogTag(id: string, patch: Record<string, unknown>): Promise<BlogTaxonomyItem>;
    deleteBlogTag(id: string): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map