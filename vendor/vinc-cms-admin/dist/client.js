"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CmsAdminClient = exports.CmsAdminError = void 0;
class CmsAdminError extends Error {
    constructor(status, message, code, details) {
        super(message);
        this.name = 'CmsAdminError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
exports.CmsAdminError = CmsAdminError;
/** Builds a CmsAdminError from a non-OK response, preserving `code` and any
 *  extra body fields (`total`, `max`, …) as `details`. */
async function toCmsAdminError(res) {
    const body = (await res.json().catch(() => ({})));
    const { error, code, ...details } = body;
    return new CmsAdminError(res.status, error || `HTTP ${res.status}`, code, details);
}
class CmsAdminClient {
    constructor(cfg) {
        this.apiBase = cfg.apiBase;
        this.fetchInit = cfg.fetchInit;
    }
    async request(method, path, body) {
        const headers = new Headers(this.fetchInit?.headers);
        if (body !== undefined)
            headers.set('Content-Type', 'application/json');
        const init = {
            ...this.fetchInit,
            method,
            cache: 'no-store',
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        };
        const res = await fetch(`${this.apiBase}${path}`, init);
        if (!res.ok) {
            throw await toCmsAdminError(res);
        }
        return res.json();
    }
    /** GET {apiBase} — the storefront's own settings record (name/slug/meta_tags/
     *  custom_scripts/custom_css/...). Unwraps {success,data}. */
    async getStorefront() {
        const envelope = await this.request('GET', '');
        return envelope.data;
    }
    /** PATCH {apiBase} with exactly the given partial record. Callers are expected to
     *  send only the fields they own (the settings screen sends meta_tags/custom_scripts/
     *  custom_css — never name/channel/domains, which are the office security contract). */
    async updateStorefront(patch) {
        const envelope = await this.request('PATCH', '', patch);
        return envelope.data;
    }
    async listPages() {
        const envelope = await this.request('GET', '/pages');
        return envelope.data.items;
    }
    async createPage(input) {
        await this.request('POST', '/pages', input);
    }
    async renamePage(pageSlug, input) {
        await this.request('PATCH', `/pages/${pageSlug}`, input);
    }
    async deletePage(pageSlug) {
        await this.request('DELETE', `/pages/${pageSlug}`);
    }
    async duplicatePage(pageSlug) {
        const envelope = await this.request('POST', `/pages/${pageSlug}/duplicate`);
        return { slug: envelope.data.slug };
    }
    async getPageTemplate(pageSlug) {
        return this.request('GET', `/pages/${pageSlug}/template`);
    }
    async savePageDraft(pageSlug, payload) {
        return this.request('POST', `/pages/${pageSlug}/template/save-draft`, payload);
    }
    async publishPage(pageSlug) {
        return this.request('POST', `/pages/${pageSlug}/template/publish`);
    }
    async getHomeTemplate(version) {
        const query = version !== undefined ? `?v=${version}` : '';
        return this.request('GET', `/home-template${query}`);
    }
    async saveHomeDraft(payload) {
        return this.request('POST', '/home-template/save-draft', payload);
    }
    async publishHome(payload) {
        return this.request('POST', '/home-template/publish', payload);
    }
    async startNewHomeVersion() {
        return this.request('POST', '/home-template/start-new-version');
    }
    async loadHomeVersion(version) {
        return this.request('POST', '/home-template/load-version', { version });
    }
    async deleteHomeVersion(version) {
        return this.request('POST', '/home-template/delete-version', { version });
    }
    async duplicateHomeVersion(version) {
        return this.request('POST', '/home-template/duplicate-version', { version });
    }
    async renameHomeVersion(version, label) {
        return this.request('PATCH', '/home-template/update-version', { version, label });
    }
    async unpublishHomeVersion(version) {
        return this.request('POST', '/home-template/unpublish-version', { version });
    }
    async listSubmissions(params) {
        const query = new URLSearchParams();
        if (params?.page !== undefined)
            query.set('page', String(params.page));
        if (params?.limit !== undefined)
            query.set('limit', String(params.limit));
        if (params?.form_type)
            query.set('form_type', params.form_type);
        if (params?.ip)
            query.set('ip', params.ip);
        if (params?.page_slug)
            query.set('page_slug', params.page_slug);
        if (params?.email)
            query.set('email', params.email);
        if (params?.seen)
            query.set('seen', params.seen);
        if (params?.date_from)
            query.set('date_from', params.date_from);
        if (params?.date_to)
            query.set('date_to', params.date_to);
        const qs = query.toString();
        const envelope = await this.request('GET', `/forms${qs ? `?${qs}` : ''}`);
        return envelope.data;
    }
    /** POSTs an export request and resolves the CSV blob. Cannot use `request`,
     *  which always parses JSON. */
    async exportSubmissions(body) {
        const headers = new Headers(this.fetchInit?.headers);
        headers.set('Content-Type', 'application/json');
        const res = await fetch(`${this.apiBase}/forms/export`, {
            ...this.fetchInit,
            method: 'POST',
            cache: 'no-store',
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw await toCmsAdminError(res);
        return res.blob();
    }
    async getSubmission(id) {
        const envelope = await this.request('GET', `/forms/${id}`);
        return envelope.data;
    }
    async setSubmissionSeen(id, seen) {
        const envelope = await this.request('PATCH', `/forms/${id}`, { seen });
        return envelope.data;
    }
    async deleteSubmission(id) {
        await this.request('DELETE', `/forms/${id}`);
    }
    async listFormDefinitions(params) {
        const query = new URLSearchParams();
        if (params?.page !== undefined)
            query.set('page', String(params.page));
        if (params?.limit !== undefined)
            query.set('limit', String(params.limit));
        const qs = query.toString();
        const envelope = await this.request('GET', `/form-definitions${qs ? `?${qs}` : ''}`);
        return envelope.data;
    }
    async createFormDefinition(input) {
        const envelope = await this.request('POST', '/form-definitions', input);
        return envelope.data;
    }
    async updateFormDefinition(slug, input) {
        const envelope = await this.request('PUT', `/form-definitions/${slug}`, input);
        return envelope.data;
    }
    async deleteFormDefinition(slug) {
        await this.request('DELETE', `/form-definitions/${slug}`);
    }
    // ========================================================================
    // Blog — maps Task 5's storefront wrapper routes ({apiBase}/blog/...). The
    // server forces the channel from the storefront slug, so these methods NEVER
    // send a `channel`/`channels` param or body field.
    // ========================================================================
    async listBlogPosts(params) {
        const query = new URLSearchParams();
        if (params?.locale)
            query.set('locale', params.locale);
        if (params?.status)
            query.set('status', params.status);
        if (params?.category)
            query.set('category', params.category);
        if (params?.tag)
            query.set('tag', params.tag);
        if (params?.q)
            query.set('q', params.q);
        if (params?.page !== undefined)
            query.set('page', String(params.page));
        if (params?.limit !== undefined)
            query.set('limit', String(params.limit));
        const qs = query.toString();
        const envelope = await this.request('GET', `/blog/posts${qs ? `?${qs}` : ''}`);
        return envelope.data;
    }
    async createBlogPost(input) {
        const envelope = await this.request('POST', '/blog/posts', input);
        return envelope.data;
    }
    async getBlogPost(postId) {
        const envelope = await this.request('GET', `/blog/posts/${postId}`);
        return envelope.data;
    }
    async updateBlogPost(postId, patch) {
        const envelope = await this.request('PATCH', `/blog/posts/${postId}`, patch);
        return envelope.data;
    }
    async deleteBlogPost(postId) {
        await this.request('DELETE', `/blog/posts/${postId}`);
    }
    async getBlogContent(postId, locale) {
        return this.request('GET', `/blog/posts/${postId}/content?locale=${encodeURIComponent(locale)}`);
    }
    async saveBlogDraft(postId, locale, payload) {
        return this.request('POST', `/blog/posts/${postId}/content/save-draft?locale=${encodeURIComponent(locale)}`, payload);
    }
    async publishBlogContent(postId, locale, options) {
        return this.request('POST', `/blog/posts/${postId}/content/publish?locale=${encodeURIComponent(locale)}`, options ?? {});
    }
    async listBlogCategories() {
        const envelope = await this.request('GET', '/blog/categories');
        return envelope.data.items;
    }
    async createBlogCategory(input) {
        const envelope = await this.request('POST', '/blog/categories', input);
        return envelope.data;
    }
    async updateBlogCategory(id, patch) {
        const envelope = await this.request('PUT', `/blog/categories/${id}`, patch);
        return envelope.data;
    }
    async deleteBlogCategory(id) {
        await this.request('DELETE', `/blog/categories/${id}`);
    }
    async listBlogTags() {
        const envelope = await this.request('GET', '/blog/tags');
        return envelope.data.items;
    }
    async createBlogTag(input) {
        const envelope = await this.request('POST', '/blog/tags', input);
        return envelope.data;
    }
    async updateBlogTag(id, patch) {
        const envelope = await this.request('PUT', `/blog/tags/${id}`, patch);
        return envelope.data;
    }
    async deleteBlogTag(id) {
        await this.request('DELETE', `/blog/tags/${id}`);
    }
}
exports.CmsAdminClient = CmsAdminClient;
//# sourceMappingURL=client.js.map