"use client";

import { useState } from "react";
import {
    Sparkles,
    Copy,
    Check,
    Loader2,
    Twitter,
    Linkedin,
    MessageSquare,
    FileText,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SpotlightCard } from "@/components/ui/Spotlight";
import { cn } from "@/lib/utils";

interface GeneratedPost {
    platform: "twitter" | "farcaster" | "linkedin";
    content: string;
    variant?: string;
}

interface LandingCopy {
    headline: string;
    subheadline: string;
    bulletPoints: string[];
    ctaButton: string;
}

interface GeneratedContent {
    posts: GeneratedPost[];
    landingCopy: LandingCopy;
    announcementThread: string[];
}

interface ContentGeneratorProps {
    brief: string;
    deliverables: string[];
    objective: string;
    audience: string;
    tone: string;
    cta: string;
    isLocked: boolean;
}

const PLATFORM_CONFIG = {
    twitter: {
        icon: Twitter,
        label: "Twitter/X",
        color: "text-sky-400",
        bg: "bg-sky-500/10",
    },
    farcaster: {
        icon: MessageSquare,
        label: "Farcaster",
        color: "text-purple-400",
        bg: "bg-purple-500/10",
    },
    linkedin: {
        icon: Linkedin,
        label: "LinkedIn",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
    },
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "p-1.5 rounded-lg transition-all",
                copied
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            )}
            title="Copy to clipboard"
        >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
    );
}

export function ContentGenerator({
    brief,
    deliverables,
    objective,
    audience,
    tone,
    cta,
    isLocked,
}: ContentGeneratorProps) {
    const [content, setContent] = useState<GeneratedContent | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState({
        posts: true,
        landing: false,
        thread: false,
    });

    async function generateContent() {
        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch("/api/generate-content", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brief,
                    deliverables,
                    objective,
                    audience,
                    tone,
                    cta,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to generate content: ${response.status}`);
            }

            const data = await response.json();
            setContent(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsGenerating(false);
        }
    }

    function toggleSection(section: keyof typeof expandedSections) {
        setExpandedSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    }

    if (!isLocked) {
        return (
            <SpotlightCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h3 className="font-semibold">AI Content Generator</h3>
                </div>
                <p className="text-sm text-gray-400">
                    Lock your brief to a hash first, then generate marketing content.
                </p>
            </SpotlightCard>
        );
    }

    return (
        <SpotlightCard className="p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h3 className="font-semibold">AI Content Generator</h3>
                </div>
                {!content && (
                    <Button
                        onClick={generateContent}
                        disabled={isGenerating}
                        variant="secondary"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Generate Content
                            </>
                        )}
                    </Button>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-4">
                    {error}
                </div>
            )}

            {content && (
                <div className="space-y-4">
                    {/* Social Posts Section */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                        <button
                            onClick={() => toggleSection("posts")}
                            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition"
                        >
                            <div className="flex items-center gap-2">
                                <Twitter className="w-4 h-4 text-sky-400" />
                                <span className="font-medium">Social Posts</span>
                                <span className="text-xs text-gray-500">({content.posts.length})</span>
                            </div>
                            {expandedSections.posts ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                        </button>

                        {expandedSections.posts && (
                            <div className="p-4 space-y-3">
                                {content.posts.map((post, idx) => {
                                    const config = PLATFORM_CONFIG[post.platform];
                                    const Icon = config.icon;

                                    return (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-lg bg-white/5 border border-white/10"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("p-1 rounded", config.bg)}>
                                                        <Icon className={cn("w-3 h-3", config.color)} />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400">
                                                        {config.label}
                                                        {post.variant && ` • ${post.variant}`}
                                                    </span>
                                                </div>
                                                <CopyButton text={post.content} />
                                            </div>
                                            <p className="text-sm text-gray-300 whitespace-pre-wrap">
                                                {post.content}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Landing Copy Section */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                        <button
                            onClick={() => toggleSection("landing")}
                            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition"
                        >
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-400" />
                                <span className="font-medium">Landing Page Copy</span>
                            </div>
                            {expandedSections.landing ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                        </button>

                        {expandedSections.landing && (
                            <div className="p-4 space-y-3">
                                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-500">Headline</span>
                                        <CopyButton text={content.landingCopy.headline} />
                                    </div>
                                    <p className="text-lg font-bold text-white">
                                        {content.landingCopy.headline}
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-500">Subheadline</span>
                                        <CopyButton text={content.landingCopy.subheadline} />
                                    </div>
                                    <p className="text-sm text-gray-300">
                                        {content.landingCopy.subheadline}
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-500">Bullet Points</span>
                                        <CopyButton text={content.landingCopy.bulletPoints.join("\n")} />
                                    </div>
                                    <ul className="space-y-1">
                                        {content.landingCopy.bulletPoints.map((point, idx) => (
                                            <li key={idx} className="text-sm text-gray-300">{point}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-500">CTA Button</span>
                                        <CopyButton text={content.landingCopy.ctaButton} />
                                    </div>
                                    <p className="text-sm font-medium text-[#0052FF]">
                                        {content.landingCopy.ctaButton}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Announcement Thread Section */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                        <button
                            onClick={() => toggleSection("thread")}
                            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition"
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-amber-400" />
                                <span className="font-medium">Announcement Thread</span>
                                <span className="text-xs text-gray-500">({content.announcementThread.length} posts)</span>
                            </div>
                            {expandedSections.thread ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                        </button>

                        {expandedSections.thread && (
                            <div className="p-4">
                                <div className="flex justify-end mb-2">
                                    <CopyButton text={content.announcementThread.join("\n\n")} />
                                </div>
                                <div className="space-y-3">
                                    {content.announcementThread.map((tweet, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-lg bg-white/5 border border-white/10 relative"
                                        >
                                            <p className="text-sm text-gray-300 whitespace-pre-wrap">
                                                {tweet}
                                            </p>
                                            {idx < content.announcementThread.length - 1 && (
                                                <div className="absolute -bottom-3 left-6 w-0.5 h-3 bg-white/20" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Regenerate Button */}
                    <Button
                        onClick={generateContent}
                        disabled={isGenerating}
                        variant="secondary"
                        className="w-full"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Regenerating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Regenerate Content
                            </>
                        )}
                    </Button>
                </div>
            )}
        </SpotlightCard>
    );
}
