import { type DeviceMode } from "../store/pageBuilderStore.js";
interface CanvasProps {
    onOpenSettings: () => void;
    isVisible?: boolean;
    onToggleVisibility?: () => void;
    isSplitView?: boolean;
    activeTab?: "builder" | "preview";
    onSelectTab?: (tab: "builder" | "preview") => void;
    device?: DeviceMode;
}
export declare const Canvas: ({ onOpenSettings, isVisible, onToggleVisibility, isSplitView, activeTab, onSelectTab, device }: CanvasProps) => import("react").JSX.Element;
export {};
//# sourceMappingURL=Canvas.d.ts.map