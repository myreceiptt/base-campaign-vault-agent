"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
    Search,
    CheckCircle,
    Circle,
    Clock,
    AlertCircle,
    ArrowRight,
    Wallet,
    Package,
    Send,
    RefreshCw,
    ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SpotlightCard } from "@/components/ui/Spotlight";
import { campaignVaultAbi } from "@/lib/abi/campaignVault";
import { BASE_SEPOLIA_CHAIN_ID, getExplorerTxUrl } from "@/lib/onchain";
import { cn } from "@/lib/utils";

// Campaign status enum matching the smart contract
enum CampaignStatus {
    NONE = 0,
    CREATED = 1,
    DEPOSITED = 2,
    DELIVERED = 3,
    RELEASED = 4,
    REFUNDED = 5,
}

const STATUS_CONFIG = {
    [CampaignStatus.NONE]: {
        label: "Not Found",
        color: "text-gray-500",
        bgColor: "bg-gray-500/20",
        icon: AlertCircle,
    },
    [CampaignStatus.CREATED]: {
        label: "Created",
        color: "text-blue-400",
        bgColor: "bg-blue-500/20",
        icon: Circle,
    },
    [CampaignStatus.DEPOSITED]: {
        label: "Deposited",
        color: "text-amber-400",
        bgColor: "bg-amber-500/20",
        icon: Wallet,
    },
    [CampaignStatus.DELIVERED]: {
        label: "Delivered",
        color: "text-purple-400",
        bgColor: "bg-purple-500/20",
        icon: Package,
    },
    [CampaignStatus.RELEASED]: {
        label: "Released",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/20",
        icon: CheckCircle,
    },
    [CampaignStatus.REFUNDED]: {
        label: "Refunded",
        color: "text-red-400",
        bgColor: "bg-red-500/20",
        icon: RefreshCw,
    },
};

// Define the lifecycle steps in order
const LIFECYCLE_STEPS = [
    { status: CampaignStatus.CREATED, label: "Created", icon: Circle },
    { status: CampaignStatus.DEPOSITED, label: "Deposited", icon: Wallet },
    { status: CampaignStatus.DELIVERED, label: "Delivered", icon: Package },
    { status: CampaignStatus.RELEASED, label: "Released", icon: Send },
];

interface CampaignData {
    advertiser: `0x${string}`;
    publisher: `0x${string}`;
    budget: bigint;
    deadline: bigint;
    status: number;
    metadataHash: `0x${string}`;
    proofHash: `0x${string}`;
}

export function CampaignStatusTracker() {
    const [campaignIdInput, setCampaignIdInput] = useState("");
    const [queriedCampaignId, setQueriedCampaignId] = useState<bigint | null>(null);

    const vaultAddress = process.env.NEXT_PUBLIC_VAULT as `0x${string}` | undefined;

    // Read campaign data from contract
    const {
        data: campaignData,
        isLoading,
        error,
        refetch,
    } = useReadContract({
        address: vaultAddress,
        abi: campaignVaultAbi,
        functionName: "campaigns",
        args: queriedCampaignId !== null ? [queriedCampaignId] : undefined,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        query: {
            enabled: queriedCampaignId !== null && !!vaultAddress,
        },
    });

    // Parse the campaign data
    const campaign = campaignData as CampaignData | undefined;
    const currentStatus = campaign?.status ?? CampaignStatus.NONE;
    const statusConfig = STATUS_CONFIG[currentStatus as CampaignStatus];
    const StatusIcon = statusConfig.icon;

    // Check if campaign was refunded (special branch)
    const wasRefunded = currentStatus === CampaignStatus.REFUNDED;

    function handleSearch() {
        const id = parseInt(campaignIdInput);
        if (!isNaN(id) && id > 0) {
            setQueriedCampaignId(BigInt(id));
        }
    }

    function formatAddress(addr: string) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }

    function formatDeadline(timestamp: bigint) {
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // Determine which step is current for the stepper
    function getStepState(stepStatus: CampaignStatus) {
        if (wasRefunded) {
            // If refunded, only Created and Deposited were completed
            if (stepStatus <= CampaignStatus.DEPOSITED) return "completed";
            return "pending";
        }

        if (stepStatus < currentStatus) return "completed";
        if (stepStatus === currentStatus) return "current";
        return "pending";
    }

    return (
        <SpotlightCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-[#0052FF]" />
                <h3 className="font-semibold">Campaign Status Tracker</h3>
            </div>

            <p className="text-sm text-gray-400 mb-4">
                Enter a Campaign ID to view its current status and lifecycle
            </p>

            {/* Search Input */}
            <div className="flex gap-2 mb-6">
                <div className="flex-1">
                    <Input
                        placeholder="Enter Campaign ID (e.g., 1)"
                        value={campaignIdInput}
                        onChange={(e) => setCampaignIdInput(e.target.value)}
                        inputMode="numeric"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                </div>
                <Button
                    onClick={handleSearch}
                    disabled={!campaignIdInput || isLoading}
                    variant="secondary"
                >
                    {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Search className="w-4 h-4" />
                    )}
                </Button>
            </div>

            {/* Campaign Not Found */}
            {queriedCampaignId !== null && campaign && currentStatus === CampaignStatus.NONE && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    <AlertCircle className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-400">
                        Campaign #{queriedCampaignId.toString()} not found
                    </span>
                </div>
            )}

            {/* Campaign Found - Display Info */}
            {queriedCampaignId !== null && campaign && currentStatus !== CampaignStatus.NONE && (
                <div className="space-y-6">
                    {/* Current Status Badge */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", statusConfig.bgColor)}>
                                <StatusIcon className={cn("w-5 h-5", statusConfig.color)} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Campaign #{queriedCampaignId.toString()}</p>
                                <p className={cn("font-semibold", statusConfig.color)}>
                                    {statusConfig.label}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => refetch()}
                            variant="secondary"
                            className="text-xs"
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Refresh
                        </Button>
                    </div>

                    {/* Lifecycle Stepper */}
                    <div className="relative">
                        <div className="flex items-center justify-between">
                            {LIFECYCLE_STEPS.map((step, index) => {
                                const state = getStepState(step.status);
                                const StepIcon = step.icon;

                                return (
                                    <div key={step.status} className="flex flex-col items-center relative z-10">
                                        {/* Step Circle */}
                                        <div
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                                state === "completed"
                                                    ? "bg-emerald-500 text-white"
                                                    : state === "current"
                                                        ? "bg-[#0052FF] text-white ring-4 ring-[#0052FF]/30"
                                                        : "bg-gray-800 text-gray-500 border border-gray-700"
                                            )}
                                        >
                                            {state === "completed" ? (
                                                <CheckCircle className="w-5 h-5" />
                                            ) : (
                                                <StepIcon className="w-5 h-5" />
                                            )}
                                        </div>

                                        {/* Step Label */}
                                        <span
                                            className={cn(
                                                "text-xs mt-2 font-medium",
                                                state === "completed"
                                                    ? "text-emerald-400"
                                                    : state === "current"
                                                        ? "text-[#0052FF]"
                                                        : "text-gray-500"
                                            )}
                                        >
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Connecting Lines */}
                        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-800 -z-0">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{
                                    width: wasRefunded
                                        ? "33%" // Stop at Deposited for refunded
                                        : currentStatus === CampaignStatus.CREATED
                                            ? "0%"
                                            : currentStatus === CampaignStatus.DEPOSITED
                                                ? "33%"
                                                : currentStatus === CampaignStatus.DELIVERED
                                                    ? "66%"
                                                    : "100%",
                                }}
                            />
                        </div>
                    </div>

                    {/* Refund Notice */}
                    {wasRefunded && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <RefreshCw className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">
                                This campaign was refunded to the advertiser
                            </span>
                        </div>
                    )}

                    {/* Campaign Details */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Advertiser</p>
                            <p className="font-mono text-sm text-gray-300">
                                {formatAddress(campaign.advertiser)}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Publisher</p>
                            <p className="font-mono text-sm text-gray-300">
                                {campaign.publisher === "0x0000000000000000000000000000000000000000"
                                    ? "Not assigned"
                                    : formatAddress(campaign.publisher)}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Budget</p>
                            <p className="text-lg font-bold bg-gradient-to-r from-[#0052FF] to-[#1CD8D2] bg-clip-text text-transparent">
                                {formatUnits(campaign.budget, 6)} USDC
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Deadline</p>
                            <p className="text-sm text-gray-300">
                                {formatDeadline(campaign.deadline)}
                            </p>
                        </div>
                    </div>

                    {/* Metadata Hash */}
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-xs text-gray-500 mb-1">Metadata Hash</p>
                        <p className="font-mono text-xs text-gray-400 break-all">
                            {campaign.metadataHash}
                        </p>
                    </div>

                    {/* Proof Hash (if delivered) */}
                    {campaign.proofHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Proof Hash</p>
                            <p className="font-mono text-xs text-gray-400 break-all">
                                {campaign.proofHash}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">
                        Error loading campaign: {error.message.split("\n")[0]}
                    </span>
                </div>
            )}
        </SpotlightCard>
    );
}
