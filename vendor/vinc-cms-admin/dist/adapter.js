"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultT = defaultT;
exports.CmsAdminProvider = CmsAdminProvider;
exports.useCmsAdmin = useCmsAdmin;
exports.useCmsAdminT = useCmsAdminT;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const i18n_defaults_js_1 = require("./i18n-defaults.js");
const search_query_js_1 = require("./search-query.js");
function defaultT(key, params) {
    let s = i18n_defaults_js_1.DEFAULT_STRINGS[key] ?? key;
    // CS's own EN dictionary mixes both interpolation styles ({{param}} in some keys,
    // {param} in others — see DEFAULT_STRINGS). Replace the double-brace form first so a
    // {{param}} placeholder isn't left mangled into a stray {param} by the single-brace pass.
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            s = s.replace(`{{${k}}}`, v).replace(`{${k}}`, v);
        }
    }
    return s;
}
const DefaultLink = ({ href, children, ...rest }) => ((0, jsx_runtime_1.jsx)("a", { href: href, ...rest, children: children }));
/** Defaults reproduce today's hard-coded CS behavior so the non-B2C CS builders
 *  keep working with NO provider mounted.
 *
 *  `client` is deliberately omitted here (see useCmsAdmin): a getter-only `client` on this
 *  object would make `{ ...makeDefaults(), ...partial }` fine, but the older
 *  `Object.assign(makeDefaults(), partial)` form throws `TypeError: Cannot set property
 *  client` whenever a provider supplies a real client, because a getter-only accessor
 *  property can't be overwritten by assignment. useCmsAdmin instead defineProperty's a
 *  throwing getter for `client` only when no provider client was supplied. */
function makeDefaults() {
    return {
        // Mirrors CS src/hooks/useImageUpload.ts: POST FormData to /api/uploads, surface the
        // response's `error` field on failure, and require a `url` field on success.
        uploadImage: async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/uploads', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
                throw new Error(errorData.error || 'Upload failed');
            }
            const json = await response.json();
            if (!json.url)
                throw new Error('No URL returned from upload');
            return json.url;
        },
        // Mirrors CS src/components/shared/ProductSearchPreview.tsx's buildSearchBody
        // (advanced-query parsing into `{ text, filters }`, lang/rows/start defaults) and its
        // response unwrapping (`data.data?.results || data.results || []`), then maps CS's
        // entity_code/cover_image_url fields onto this package's id/image fields.
        searchProducts: async (query, opts) => {
            const trimmed = query.trim();
            if (!trimmed)
                return [];
            const response = await fetch('/api/search/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, search_query_js_1.buildSearchBody)(trimmed, opts?.limit ?? 12)),
            });
            if (!response.ok)
                return [];
            const json = await response.json();
            const results = (json?.data?.results ?? json?.results ?? []);
            return results.map((p) => ({
                ...p,
                id: String(p.entity_code ?? p.id ?? ''),
                sku: p.sku,
                name: p.name ?? '',
                image: p.cover_image_url ?? p.image,
                price: p.price,
            }));
        },
        t: defaultT,
        links: { pagesList: '#', pageBuilder: () => '#', homeBuilder: '#', dashboard: '#', blogBuilder: () => '#', blogList: '#' },
        previewUrl: () => undefined,
        LinkComponent: DefaultLink,
        locales: [{ code: 'it' }],
    };
}
const CmsAdminContext = (0, react_1.createContext)(null);
function CmsAdminProvider({ adapter, children }) {
    return (0, jsx_runtime_1.jsx)(CmsAdminContext.Provider, { value: adapter, children: children });
}
function useCmsAdmin() {
    const partial = (0, react_1.useContext)(CmsAdminContext);
    return (0, react_1.useMemo)(() => {
        const merged = { ...makeDefaults(), ...partial };
        if (!partial?.client) {
            Object.defineProperty(merged, 'client', {
                get() {
                    throw new Error('CmsAdminProvider with a client is required for CMS screens');
                },
                configurable: true,
            });
        }
        return merged;
    }, [partial]);
}
function useCmsAdminT() {
    return useCmsAdmin().t;
}
//# sourceMappingURL=adapter.js.map