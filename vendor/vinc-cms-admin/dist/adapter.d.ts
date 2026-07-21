import { type ReactNode, type ComponentType } from 'react';
import type { CmsAdminClient } from './client.js';
/** Shape kept from CS ProductSearchPreview's SearchPreviewProduct, renamed to the
 *  package's own id/image field names (see searchProducts default below for mapping). */
export interface SearchPreviewProduct {
    id: string;
    sku?: string;
    name: string;
    image?: string;
    price?: number;
    [key: string]: unknown;
}
export interface CmsAdminLinks {
    pagesList: string;
    pageBuilder: (pageSlug: string) => string;
    homeBuilder: string;
    dashboard: string;
}
export interface CmsAdminAdapter {
    client: CmsAdminClient;
    /** returns public URL */
    uploadImage: (file: File) => Promise<string>;
    searchProducts: (query: string, opts?: {
        limit?: number;
    }) => Promise<SearchPreviewProduct[]>;
    t: (key: string, params?: Record<string, string>) => string;
    links: CmsAdminLinks;
    /** Full URL for the LivePreview iframe; undefined -> "not configured" panel. */
    previewUrl: (opts: {
        pageSlug?: string;
    }) => string | undefined;
    LinkComponent: ComponentType<{
        href: string;
        className?: string;
        title?: string;
        children: ReactNode;
    }>;
    /** Uploads a generic file (e.g. a JS asset from ScriptsSection) and returns its public
     *  URL. Optional: when omitted, ScriptsSection's ScriptAssetUpload falls back to POSTing
     *  its own `scriptUploadEndpoint` FormData request. */
    uploadFile?: (file: File) => Promise<{
        url: string;
        fileName?: string;
    }>;
}
export declare function defaultT(key: string, params?: Record<string, string>): string;
export declare function CmsAdminProvider({ adapter, children }: {
    adapter: Partial<CmsAdminAdapter>;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useCmsAdmin(): CmsAdminAdapter;
export declare function useCmsAdminT(): CmsAdminAdapter['t'];
//# sourceMappingURL=adapter.d.ts.map