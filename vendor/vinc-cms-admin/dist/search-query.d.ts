/** Extract keyword + filters from advanced query strings like `shop?text=moon&filters-brand_id=004`. */
export declare function parseAdvancedQuery(raw: string): {
    keyword: string;
    filters: Array<{
        key: string;
        values: string[];
    }>;
} | null;
/**
 * Build the POST body for /api/search/search from a raw query.
 *
 * A plain keyword becomes `{ lang, rows, start, text }`. An advanced query
 * (`shop?text=moon&filters-brand_id=004`) is parsed into `{ ..., text, filters }`
 * where `filters` is a `Record<string,string>` keyed by the un-prefixed filter name.
 */
export declare function buildSearchBody(raw: string, limit: number): Record<string, unknown>;
//# sourceMappingURL=search-query.d.ts.map