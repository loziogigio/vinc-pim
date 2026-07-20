interface MediaImageStyle {
    borderWidth: number;
    borderColor: string;
    borderStyle: "solid" | "dashed" | "dotted" | "none";
    borderRadius: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
    shadowSize: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
    shadowColor: string;
    backgroundColor: string;
    hoverEffect: "none" | "lift" | "shadow" | "scale" | "border" | "glow";
    hoverScale?: number;
    hoverShadowSize?: "sm" | "md" | "lg" | "xl" | "2xl";
    hoverBackgroundColor?: string;
}
interface MediaImageConfig {
    title?: string;
    imageUrl: string;
    alt?: string;
    linkUrl?: string;
    openInNewTab?: boolean;
    width?: string;
    maxWidth?: string;
    alignment?: "left" | "center" | "right";
    style?: MediaImageStyle;
    className?: string;
}
interface MediaImageBlockSettingsProps {
    config: MediaImageConfig;
    onChange: (config: MediaImageConfig) => void;
}
export declare function MediaImageBlockSettings({ config, onChange }: MediaImageBlockSettingsProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=MediaImageBlockSettings.d.ts.map