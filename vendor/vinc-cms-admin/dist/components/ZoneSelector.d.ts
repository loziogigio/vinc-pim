import type { ProductDetailZone } from "../types.js";
interface ZoneSelectorProps {
    zone?: ProductDetailZone;
    tabLabel?: string;
    onChange: (zone: ProductDetailZone, tabLabel?: string) => void;
}
export declare function ZoneSelector({ zone, tabLabel, onChange }: ZoneSelectorProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ZoneSelector.d.ts.map