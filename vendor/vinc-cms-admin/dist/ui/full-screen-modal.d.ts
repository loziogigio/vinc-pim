interface FullScreenModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    /** Optional footer actions (Save/Cancel buttons) */
    actions?: React.ReactNode;
    /** Max width class for body content (default: "max-w-3xl") */
    maxWidth?: string;
}
export declare function FullScreenModal({ open, onClose, title, children, actions, maxWidth, }: FullScreenModalProps): import("react").ReactPortal | null;
export {};
//# sourceMappingURL=full-screen-modal.d.ts.map