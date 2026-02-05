"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypewriterProps {
    words: string[];
    className?: string;
    cursorClassName?: string;
    typingSpeed?: number;
    deletingSpeed?: number;
    delayBetweenWords?: number;
}

export function Typewriter({
    words,
    className,
    cursorClassName,
    typingSpeed = 100,
    deletingSpeed = 50,
    delayBetweenWords = 1500,
}: TypewriterProps) {
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const word = words[currentWordIndex];

        if (!isDeleting) {
            if (currentText.length < word.length) {
                const timeout = setTimeout(() => {
                    setCurrentText(word.slice(0, currentText.length + 1));
                }, typingSpeed);
                return () => clearTimeout(timeout);
            } else {
                const timeout = setTimeout(() => {
                    setIsDeleting(true);
                }, delayBetweenWords);
                return () => clearTimeout(timeout);
            }
        } else {
            if (currentText.length > 0) {
                const timeout = setTimeout(() => {
                    setCurrentText(currentText.slice(0, -1));
                }, deletingSpeed);
                return () => clearTimeout(timeout);
            } else {
                setIsDeleting(false);
                setCurrentWordIndex((prev) => (prev + 1) % words.length);
            }
        }
    }, [currentText, isDeleting, currentWordIndex, words, typingSpeed, deletingSpeed, delayBetweenWords]);

    return (
        <span className={cn("inline-flex", className)}>
            <span>{currentText}</span>
            <span
                className={cn(
                    "ml-1 inline-block w-[4px] h-[1em] bg-[var(--base-blue)] animate-blink",
                    cursorClassName
                )}
            />
        </span>
    );
}

interface FlipWordsProps {
    words: string[];
    className?: string;
    duration?: number;
}

export function FlipWords({
    words,
    className,
    duration = 3000,
}: FlipWordsProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % words.length);
        }, duration);
        return () => clearInterval(interval);
    }, [words.length, duration]);

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={cn("inline-block", className)}
            >
                {words[currentIndex]}
            </motion.span>
        </AnimatePresence>
    );
}

interface GradientTextProps {
    children: React.ReactNode;
    className?: string;
    colors?: string[];
    animate?: boolean;
}

export function GradientText({
    children,
    className,
    colors = ["#0052FF", "#1CD8D2", "#93EDC7"],
    animate = true,
}: GradientTextProps) {
    return (
        <span
            className={cn(
                "inline-block bg-clip-text text-transparent",
                animate && "animate-gradient-x",
                className
            )}
            style={{
                backgroundImage: `linear-gradient(90deg, ${colors.join(", ")}, ${colors[0]})`,
                backgroundSize: animate ? "200% 100%" : "100% 100%",
            }}
        >
            {children}
        </span>
    );
}

interface TextGenerateEffectProps {
    words: string;
    className?: string;
    filter?: boolean;
    duration?: number;
}

export function TextGenerateEffect({
    words,
    className,
    filter = true,
    duration = 0.5,
}: TextGenerateEffectProps) {
    const [displayedWords, setDisplayedWords] = useState<string[]>([]);
    const wordsArray = words.split(" ");

    useEffect(() => {
        let index = 0;
        const interval = setInterval(() => {
            if (index <= wordsArray.length) {
                setDisplayedWords(wordsArray.slice(0, index));
                index++;
            } else {
                clearInterval(interval);
            }
        }, duration * 100);
        return () => clearInterval(interval);
    }, [words]);

    return (
        <div className={cn("font-bold", className)}>
            {displayedWords.map((word, idx) => (
                <motion.span
                    key={word + idx}
                    initial={{ opacity: 0, filter: filter ? "blur(10px)" : "none" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: duration, delay: idx * 0.1 }}
                    className="mr-1"
                >
                    {word}
                </motion.span>
            ))}
        </div>
    );
}
