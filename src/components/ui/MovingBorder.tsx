"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MovingBorderProps {
    children: React.ReactNode;
    duration?: number;
    className?: string;
    containerClassName?: string;
    borderRadius?: string;
    colors?: string[];
}

export function MovingBorder({
    children,
    duration = 3000,
    className,
    containerClassName,
    borderRadius = "1rem",
    colors = ["#0052FF", "#1CD8D2", "#93EDC7", "#0052FF"],
}: MovingBorderProps) {
    return (
        <div
            className={cn(
                "relative p-[2px] overflow-hidden",
                containerClassName
            )}
            style={{
                borderRadius,
            }}
        >
            {/* Animated gradient border */}
            <div
                className="absolute inset-0"
                style={{
                    borderRadius,
                    background: `linear-gradient(90deg, ${colors.join(", ")})`,
                    backgroundSize: "300% 300%",
                    animation: `gradient-move ${duration}ms linear infinite`,
                }}
            />
            {/* Inner content */}
            <div
                className={cn("relative bg-[var(--card)] z-10", className)}
                style={{ borderRadius: `calc(${borderRadius} - 2px)` }}
            >
                {children}
            </div>
        </div>
    );
}

interface HoverBorderGradientProps {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
    as?: React.ElementType;
    duration?: number;
}

export function HoverBorderGradient({
    children,
    className,
    containerClassName,
    as: Tag = "button",
    duration = 500,
}: HoverBorderGradientProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <Tag
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                "relative p-[2px] group",
                containerClassName
            )}
        >
            {/* Background gradient */}
            <motion.div
                className="absolute inset-0 rounded-xl z-[1]"
                style={{
                    background: "linear-gradient(90deg, #0052FF, #1CD8D2, #93EDC7, #0052FF)",
                    backgroundSize: "300% 100%",
                }}
                animate={{
                    backgroundPosition: hovered ? ["0% 0%", "100% 0%"] : "0% 0%",
                }}
                transition={{
                    duration: duration / 1000,
                    ease: "linear",
                    repeat: hovered ? Infinity : 0,
                }}
            />
            {/* Content container */}
            <div
                className={cn(
                    "relative z-10 rounded-[10px] bg-[var(--card)] px-6 py-3",
                    className
                )}
            >
                {children}
            </div>
        </Tag>
    );
}

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    shimmerColor?: string;
    shimmerSize?: string;
    borderRadius?: string;
    shimmerDuration?: string;
    background?: string;
    children: React.ReactNode;
}

export function ShimmerButton({
    shimmerColor = "#ffffff",
    shimmerSize = "0.1em",
    borderRadius = "100px",
    shimmerDuration = "2s",
    background = "linear-gradient(135deg, #0052FF 0%, #1E3A8A 100%)",
    className,
    children,
    ...props
}: ShimmerButtonProps) {
    return (
        <button
            className={cn(
                "group relative inline-flex items-center justify-center overflow-hidden whitespace-nowrap px-6 py-3 font-semibold text-white transition-all duration-300 ease-out hover:scale-105 active:scale-95",
                className
            )}
            style={{
                background,
                borderRadius,
            }}
            {...props}
        >
            {/* Shimmer effect */}
            <div
                className="absolute inset-0 overflow-hidden"
                style={{ borderRadius }}
            >
                <div
                    className="absolute inset-0 animate-shimmer-slide"
                    style={{
                        background: `linear-gradient(90deg, transparent, ${shimmerColor}20, transparent)`,
                        transform: "translateX(-100%)",
                    }}
                />
            </div>
            {/* Content */}
            <span className="relative z-10 flex items-center gap-2">
                {children}
            </span>
        </button>
    );
}
