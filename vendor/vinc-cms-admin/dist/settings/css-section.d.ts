/**
 * Single custom-CSS editor. Shared by the B2B portal and B2C storefront detail
 * pages — the CSS is injected into the storefront <head> as one <style> block.
 */
export declare function CssSection({ css, onChange, saving, onSave, }: {
    css: string;
    onChange: (css: string) => void;
    saving: boolean;
    onSave: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=css-section.d.ts.map