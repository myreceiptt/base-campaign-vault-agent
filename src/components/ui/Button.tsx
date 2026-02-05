"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            variant = "primary",
            size = "md",
            isLoading = false,
            leftIcon,
            rightIcon,
            disabled,
            className = "",
            ...props
        },
        ref
    ) => {
        const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-xl
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    `;

        const variantStyles = {
            primary: `
        bg-[var(--base-blue)] text-white
        hover:bg-[var(--base-blue-dark)] hover:shadow-md hover:-translate-y-0.5
        focus:ring-[var(--base-blue)]
        active:translate-y-0
      `,
            secondary: `
        bg-[var(--card)] text-[var(--foreground)]
        border border-[var(--border)]
        hover:bg-[var(--muted)] hover:border-[var(--muted-foreground)]
        focus:ring-[var(--border)]
      `,
            ghost: `
        bg-transparent text-[var(--foreground)]
        hover:bg-[var(--muted)]
        focus:ring-[var(--border)]
      `,
            danger: `
        bg-[var(--error)] text-white
        hover:opacity-90 hover:shadow-md hover:-translate-y-0.5
        focus:ring-[var(--error)]
        active:translate-y-0
      `,
        };

        const sizeStyles = {
            sm: "h-9 px-3 text-sm",
            md: "h-11 px-5 text-sm",
            lg: "h-12 px-6 text-base",
        };

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
                {...props}
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : leftIcon ? (
                    <span className="shrink-0">{leftIcon}</span>
                ) : null}
                {children}
                {!isLoading && rightIcon && (
                    <span className="shrink-0">{rightIcon}</span>
                )}
            </button>
        );
    }
);

Button.displayName = "Button";
