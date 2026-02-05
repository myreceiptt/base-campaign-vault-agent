"use client";

import { cn } from "@/lib/utils";

interface DotBackgroundProps {
    className?: string;
    children?: React.ReactNode;
    dotColor?: string;
    bgColor?: string;
}

export function DotBackground({
    className,
    children,
    dotColor = "rgba(59, 130, 246, 0.4)",
    bgColor = "transparent",
}: DotBackgroundProps) {
    return (
        <div
            className={cn(
                "relative w-full overflow-hidden",
                className
            )}
            style={{
                background: bgColor,
            }}
        >
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `radial-gradient(${dotColor} 1.5px, transparent 1.5px)`,
                    backgroundSize: "32px 32px",
                }}
            />
            {/* Radial fade overlay */}
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(ellipse at center, transparent 0%, var(--background) 80%)",
                }}
            />
            <div className="relative z-10">{children}</div>
        </div>
    );
}

interface GridBackgroundProps {
    className?: string;
    children?: React.ReactNode;
    gridColor?: string;
}

export function GridBackground({
    className,
    children,
    gridColor = "rgba(59, 130, 246, 0.07)",
}: GridBackgroundProps) {
    return (
        <div className={cn("relative w-full overflow-hidden", className)}>
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `
            linear-gradient(${gridColor} 1px, transparent 1px),
            linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
          `,
                    backgroundSize: "64px 64px",
                }}
            />
            {/* Radial fade overlay for depth */}
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(ellipse at top center, transparent 0%, var(--background) 70%)",
                }}
            />
            <div className="relative z-10">{children}</div>
        </div>
    );
}
