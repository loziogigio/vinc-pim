import { type SearchPreviewProduct } from "../adapter.js";
export type { SearchPreviewProduct };
interface ProductSearchPreviewProps {
    searchQuery: string;
    limit: number;
    /** Already-loaded products (for restoring state on re-open) */
    cachedProducts?: SearchPreviewProduct[];
    onSearchChange: (query: string) => void;
    onLimitChange: (limit: number) => void;
    onProductsLoaded: (products: SearchPreviewProduct[]) => void;
}
export declare function ProductSearchPreview({ searchQuery, limit, cachedProducts, onSearchChange, onLimitChange, onProductsLoaded, }: ProductSearchPreviewProps): import("react").JSX.Element;
//# sourceMappingURL=ProductSearchPreview.d.ts.map