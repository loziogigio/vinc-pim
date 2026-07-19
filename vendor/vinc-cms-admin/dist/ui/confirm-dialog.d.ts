interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info" | "success";
    onConfirm: () => void;
    onCancel: () => void;
}
export declare const ConfirmDialog: ({ open, title, message, confirmText, cancelText, variant, onConfirm, onCancel }: ConfirmDialogProps) => import("react").JSX.Element | null;
export {};
//# sourceMappingURL=confirm-dialog.d.ts.map