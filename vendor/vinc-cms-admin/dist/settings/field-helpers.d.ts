export declare const inputClass = "w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground bg-background focus:border-primary focus:outline-none";
export declare const labelClass = "block text-sm font-medium text-foreground mb-1";
export declare const helperClass = "mt-1 text-xs text-muted-foreground";
export declare function Field({ label, helper, children, }: {
    label: string;
    helper?: string;
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function ColorField({ label, value, onChange, helper, }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    helper?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=field-helpers.d.ts.map