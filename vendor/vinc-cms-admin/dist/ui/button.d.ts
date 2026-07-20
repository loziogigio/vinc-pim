import * as React from "react";
type ButtonVariant = "default" | "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "icon";
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=button.d.ts.map