import type { PageVersion } from "../types.js";
interface VersionHistoryProps {
    versions: PageVersion[];
    currentVersion: number;
    currentPublishedVersion?: number;
    isDirty: boolean;
    onLoadVersion: (version: number) => Promise<void>;
    onDelete: (version: number) => Promise<void>;
    onDuplicate: (version: number) => Promise<void>;
    onRenameVersion?: (version: number, label: string) => Promise<void>;
    onPublishVersion?: (version: number) => Promise<void>;
    onRequestPublishVersion?: (version: number) => void;
    onUnpublishVersion?: (version: number) => Promise<void>;
    onClose: () => void;
}
export declare const VersionHistory: ({ versions, currentVersion, currentPublishedVersion, isDirty, onLoadVersion, onDelete, onDuplicate, onRenameVersion, onPublishVersion, onRequestPublishVersion, onUnpublishVersion, onClose }: VersionHistoryProps) => import("react").JSX.Element;
export {};
//# sourceMappingURL=VersionHistory.d.ts.map