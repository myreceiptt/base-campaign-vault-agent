"use client";

import { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "glow" | "glass";
    padding?: "none" | "sm" | "md" | "lg";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    (
        {
            children,
            variant = "default",
            padding = "md",
            className = "",
            ...props
        },
        ref
    ) => {
        const baseStyles = "rounded-2xl transition-all duration-200";

        const variantStyles = {
            default: `
        bg-[var(--card)] 
        border border-[var(--border)] 
        shadow-[var(--shadow-sm)]
        hover:shadow-[var(--shadow-md)]
      `,
            glow: `
        bg-[var(--card)] 
        border border-[var(--base-blue-100)]
        shadow-[var(--shadow-glow)]
      `,
            glass: `
        backdrop-blur-xl
        bg-white/70 dark:bg-[var(--card)]/70
        border border-white/20 dark:border-white/10
      `,
        };

        const paddingStyles = {
            none: "",
            sm: "p-4",
            md: "p-6",
            lg: "p-8",
        };

        return (
            <div
                ref={ref}
                className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = "Card";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> { }

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ children, className = "", ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`flex flex-col gap-1.5 ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

CardHeader.displayName = "CardHeader";

export interface CardTitleProps
    extends React.HTMLAttributes<HTMLHeadingElement> {
    as?: "h1" | "h2" | "h3" | "h4";
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ children, as: Component = "h2", className = "", ...props }, ref) => {
        return (
            <Component
                ref={ref}
                className={`text-lg font-semibold tracking-tight ${className}`}
                {...props}
            >
                {children}
            </Component>
        );
    }
);

CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps
    extends React.HTMLAttributes<HTMLParagraphElement> { }

export const CardDescription = forwardRef<
    HTMLParagraphElement,
    CardDescriptionProps
>(({ children, className = "", ...props }, ref) => {
    return (
        <p
            ref={ref}
            className={`text-sm text-[var(--muted-foreground)] ${className}`}
            {...props}
        >
            {children}
        </p>
    );
});

CardDescription.displayName = "CardDescription";

export interface CardContentProps
    extends React.HTMLAttributes<HTMLDivElement> { }

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
    ({ children, className = "", ...props }, ref) => {
        return (
            <div ref={ref} className={`${className}`} {...props}>
                {children}
            </div>
        );
    }
);

CardContent.displayName = "CardContent";

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> { }

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
    ({ children, className = "", ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`flex items-center pt-4 ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

CardFooter.displayName = "CardFooter";
