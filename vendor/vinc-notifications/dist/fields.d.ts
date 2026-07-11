export type NotificationFieldType = "text" | "number" | "checkbox" | "select" | "secret";
export interface NotificationFieldOption {
    value: string;
    label: string;
}
export interface NotificationFieldDescriptor {
    slug: string;
    label: string;
    type: NotificationFieldType;
    secret?: boolean;
    options?: NotificationFieldOption[];
}
export declare const NOTIFICATION_SETTINGS_FIELDS: NotificationFieldDescriptor[];
//# sourceMappingURL=fields.d.ts.map