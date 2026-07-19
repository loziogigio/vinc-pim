"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CmsAdminClient = exports.CmsAdminError = void 0;
class CmsAdminError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'CmsAdminError';
        this.status = status;
    }
}
exports.CmsAdminError = CmsAdminError;
class CmsAdminClient {
    constructor(cfg) {
        this.cfg = cfg;
    }
    async request(method, path, body) {
        const headers = new Headers(this.cfg.fetchInit?.headers);
        if (body !== undefined)
            headers.set('Content-Type', 'application/json');
        const init = {
            ...this.cfg.fetchInit,
            method,
            cache: 'no-store',
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        };
        const res = await fetch(`${this.cfg.apiBase}${path}`, init);
        if (!res.ok) {
            const errBody = (await res.json().catch(() => ({})));
            throw new CmsAdminError(res.status, errBody.error || `HTTP ${res.status}`);
        }
        return res.json();
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
}
exports.CmsAdminClient = CmsAdminClient;
//# sourceMappingURL=client.js.map