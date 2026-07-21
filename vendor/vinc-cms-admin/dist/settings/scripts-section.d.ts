import type { IB2CCustomScript } from "./types.js";
export declare function ScriptsSection({ scripts, onChange, saving, onSave, scriptUploadEndpoint, onUploadFile, }: {
    scripts: IB2CCustomScript[];
    onChange: (scripts: IB2CCustomScript[]) => void;
    saving: boolean;
    onSave: () => void;
    scriptUploadEndpoint?: string;
    /** Preferred over scriptUploadEndpoint when both are set — see ScriptAssetUpload. */
    onUploadFile?: (file: File) => Promise<{
        url: string;
        fileName?: string;
    }>;
}): import("react").JSX.Element;
//# sourceMappingURL=scripts-section.d.ts.map