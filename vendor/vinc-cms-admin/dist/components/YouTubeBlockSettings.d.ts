interface YouTubeConfig {
    url: string;
    title?: string;
    autoplay?: boolean;
    width?: string;
    height?: string;
}
interface YouTubeBlockSettingsProps {
    config: YouTubeConfig;
    onChange: (config: YouTubeConfig) => void;
}
export declare function YouTubeBlockSettings({ config, onChange }: YouTubeBlockSettingsProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=YouTubeBlockSettings.d.ts.map