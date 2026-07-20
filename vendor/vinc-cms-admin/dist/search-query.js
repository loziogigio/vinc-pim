"use strict";
// Advanced-query parsing shared by the default `searchProducts` adapter and the
// ProductSearchPreview summary UI. Ported verbatim from the CS
// src/components/shared/ProductSearchPreview.tsx that this package replaced, so the
// POST /api/search/search body matches the old builder byte-for-byte for advanced queries.
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAdvancedQuery = parseAdvancedQuery;
exports.buildSearchBody = buildSearchBody;
/** Strip the `shop?` / `search?` / leading `?` prefix, leaving a bare query string. */
function toQueryString(trimmed) {
    return trimmed.startsWith('shop?')
        ? trimmed.slice(5)
        : trimmed.startsWith('search?')
            ? trimmed.slice(7)
            : trimmed.replace(/^\?/, '');
}
/** Extract keyword + filters from advanced query strings like `shop?text=moon&filters-brand_id=004`. */
function parseAdvancedQuery(raw) {
    const trimmed = raw.trim();
    if (!/[?=&]/.test(trimmed))
        return null;
    try {
        const params = new URLSearchParams(toQueryString(trimmed));
        const keyword = params.get('text') || '';
        const filters = [];
        params.forEach((value, key) => {
            if (key === 'text')
                return;
            const normalizedKey = key.startsWith('filters-') ? key.replace(/^filters-/, '') : key;
            const values = value
                .split(';')
                .map((item) => item.trim())
                .filter(Boolean);
            if (values.length) {
                filters.push({ key: normalizedKey, values });
            }
        });
        return { keyword, filters };
    }
    catch {
        return null;
    }
}
/**
 * Build the POST body for /api/search/search from a raw query.
 *
 * A plain keyword becomes `{ lang, rows, start, text }`. An advanced query
 * (`shop?text=moon&filters-brand_id=004`) is parsed into `{ ..., text, filters }`
 * where `filters` is a `Record<string,string>` keyed by the un-prefixed filter name.
 */
function buildSearchBody(raw, limit) {
    const trimmed = raw.trim();
    const body = { lang: 'it', rows: limit, start: 0 };
    if (/[?=&]/.test(trimmed)) {
        try {
            const parsed = new URLSearchParams(toQueryString(trimmed));
            const extractedText = parsed.get('text');
            if (extractedText)
                body.text = extractedText;
            const filters = {};
            parsed.forEach((value, key) => {
                if (key === 'text')
                    return;
                const filterKey = key.startsWith('filters-') ? key.replace(/^filters-/, '') : key;
                filters[filterKey] = value;
            });
            if (Object.keys(filters).length)
                body.filters = filters;
        }
        catch {
            body.text = trimmed;
        }
    }
    else {
        body.text = trimmed;
    }
    return body;
}
//# sourceMappingURL=search-query.js.map