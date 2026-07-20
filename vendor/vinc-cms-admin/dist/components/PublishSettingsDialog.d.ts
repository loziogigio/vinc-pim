export interface PublishFormValues {
    campaign?: string;
    segment?: string;
    region?: string;
    language?: string;
    device?: string;
    addressStates?: string;
    priority: number;
    isDefault: boolean;
    activeFrom?: string;
    activeTo?: string;
    comment?: string;
}
interface PublishSettingsDialogProps {
    open: boolean;
    version?: number | null;
    isSubmitting: boolean;
    values: PublishFormValues;
    onChange: (field: keyof PublishFormValues, value: string | number | boolean) => void;
    onClose: () => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}
export declare function PublishSettingsDialog({ open, version, isSubmitting, values, onChange, onClose, onSubmit }: PublishSettingsDialogProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=PublishSettingsDialog.d.ts.map