"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ArrowRightLeft, Loader2, CheckCircle, ExternalLink, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SpotlightCard } from "@/components/ui/Spotlight";

// LI.FI Staging API supports testnets!
// Production: https://li.quest
// Staging (testnets): https://staging.li.quest
const LIFI_API_URL = "https://staging.li.quest";

// Testnet chains supported by LI.FI staging
const SUPPORTED_SOURCE_CHAINS = [
    { id: 11155111, name: "Sepolia", logo: "🔷" },
    { id: 421614, name: "Arbitrum Sepolia", logo: "🔵" },
    { id: 11155420, name: "Optimism Sepolia", logo: "🔴" },
];

// Destination: Base Sepolia
const BASE_SEPOLIA_CHAIN_ID = 84532;

// USDC token addresses on testnets
// Note: These are testnet USDC - may need to be updated based on actual deployed addresses
const USDC_ADDRESSES: Record<number, string> = {
    11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC (Circle's testnet)
    421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia USDC
    11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7", // Optimism Sepolia USDC
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
};

interface BridgeQuote {
    estimate: {
        toAmount: string;
        toAmountMin: string;
        approvalAddress: string;
        gasCosts: Array<{ amountUSD: string }>;
        feeCosts: Array<{ amountUSD: string }>;
    };
    transactionRequest: {
        to: string;
        data: string;
        value: string;
        gasLimit: string;
        chainId: number;
    };
    action: {
        fromToken: { address: string; decimals: number; symbol: string };
        toToken: { address: string; decimals: number; symbol: string };
    };
    tool: string;
}

interface BridgeStatus {
    status: "PENDING" | "DONE" | "FAILED" | "NOT_FOUND";
    substatus?: string;
    receiving?: {
        txHash?: string;
        amount?: string;
    };
}

export function LiFiBridge({ onBridgeComplete }: { onBridgeComplete?: () => void }) {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    // Form state
    const [sourceChain, setSourceChain] = useState(11155111); // Default: Sepolia testnet
    const [amount, setAmount] = useState("");
    const [quote, setQuote] = useState<BridgeQuote | null>(null);
    const [isGettingQuote, setIsGettingQuote] = useState(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);

    // Transaction state
    const [bridgeTxHash, setBridgeTxHash] = useState<`0x${string}` | null>(null);
    const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
    const [isPollingStatus, setIsPollingStatus] = useState(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: bridgeTxHash ?? undefined,
    });

    function clearStatusPolling() {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }

    useEffect(() => {
        return () => {
            clearStatusPolling();
        };
    }, []);

    // Get quote from LI.FI API
    async function getQuote() {
        if (!address || !amount) return;

        setIsGettingQuote(true);
        setQuoteError(null);
        setQuote(null);

        try {
            const fromAmount = parseUnits(amount, 6).toString(); // USDC has 6 decimals
            const params = new URLSearchParams({
                fromChain: sourceChain.toString(),
                toChain: BASE_SEPOLIA_CHAIN_ID.toString(), // Bridge to Base Sepolia using staging API
                fromToken: USDC_ADDRESSES[sourceChain],
                toToken: USDC_ADDRESSES[BASE_SEPOLIA_CHAIN_ID],
                fromAmount,
                fromAddress: address,
                integrator: "campaign-vault-agent",
            });

            const response = await fetch(`${LIFI_API_URL}/v1/quote?${params}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to get quote: ${response.status}`);
            }

            const quoteData = await response.json();
            setQuote(quoteData);
        } catch (err) {
            setQuoteError((err as Error).message);
        } finally {
            setIsGettingQuote(false);
        }
    }

    // Execute bridge transaction
    async function executeBridge() {
        if (!quote || !address) return;

        try {
            // Make sure user is on the source chain
            if (chainId !== sourceChain) {
                await switchChain({ chainId: sourceChain });
                return;
            }

            // Send the bridge transaction
            const hash = await sendTransactionAsync({
                to: quote.transactionRequest.to as `0x${string}`,
                data: quote.transactionRequest.data as `0x${string}`,
                value: BigInt(quote.transactionRequest.value || "0"),
                chainId: sourceChain,
            });

            setBridgeTxHash(hash);
            // Start polling for bridge status
            pollBridgeStatus(hash);
        } catch (err) {
            setQuoteError((err as Error).message);
        }
    }

    // Poll bridge status
    async function pollBridgeStatus(txHash: string) {
        if (!quote) return;

        clearStatusPolling();
        setIsPollingStatus(true);
        const maxAttempts = 60; // Poll for up to 5 minutes
        let attempts = 0;

        pollIntervalRef.current = setInterval(async () => {
            attempts++;

            try {
                const params = new URLSearchParams({
                    bridge: quote.tool,
                    fromChain: sourceChain.toString(),
                    toChain: BASE_SEPOLIA_CHAIN_ID.toString(),
                    txHash,
                });

                const response = await fetch(`${LIFI_API_URL}/v1/status?${params}`);
                const status: BridgeStatus = await response.json();
                setBridgeStatus(status);

                if (status.status === "DONE" || status.status === "FAILED" || attempts >= maxAttempts) {
                    clearStatusPolling();
                    setIsPollingStatus(false);

                    if (status.status === "DONE" && onBridgeComplete) {
                        onBridgeComplete();
                    }
                }
            } catch (err) {
                console.error("Error polling bridge status:", err);
            }
        }, 5000); // Poll every 5 seconds
    }

    // Calculate estimated fees
    const estimatedFees = useMemo(() => {
        if (!quote) return null;

        const gasCost = quote.estimate.gasCosts.reduce((sum, g) => sum + parseFloat(g.amountUSD), 0);
        const feeCost = quote.estimate.feeCosts.reduce((sum, f) => sum + parseFloat(f.amountUSD), 0);

        return {
            gas: gasCost.toFixed(2),
            fees: feeCost.toFixed(2),
            total: (gasCost + feeCost).toFixed(2),
        };
    }, [quote]);

    // Determine if we need to switch chains
    const needsChainSwitch = chainId !== sourceChain;

    return (
        <SpotlightCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
                <ArrowRightLeft className="w-5 h-5 text-[#0052FF]" />
                <h3 className="font-semibold">Bridge USDC to Base</h3>
                <span className="text-xs bg-gradient-to-r from-[#0052FF] to-[#1CD8D2] text-white px-2 py-0.5 rounded-full">
                    via LI.FI
                </span>
            </div>

            <p className="text-sm text-gray-400 mb-4">
                Bridge USDC from other chains to fund your campaign
            </p>

            {/* Mainnet Only Disclaimer */}
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-amber-400">Mainnet Only</p>
                        <p className="text-xs text-amber-400/70 mt-1">
                            LI.FI bridging works on mainnet only. For testnet, get USDC directly from{" "}
                            <a
                                href="https://faucet.circle.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-amber-300"
                            >
                                Circle Faucet
                            </a>
                        </p>
                    </div>
                </div>
            </div>

            {/* Source Chain Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">From Chain</label>
                <div className="flex gap-2">
                    {SUPPORTED_SOURCE_CHAINS.map((chain) => (
                        <button
                            key={chain.id}
                            onClick={() => setSourceChain(chain.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${sourceChain === chain.id
                                ? "border-[#0052FF] bg-[#0052FF]/10 text-white"
                                : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                                }`}
                        >
                            <span>{chain.logo}</span>
                            <span className="text-sm">{chain.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
                <Input
                    label="Amount (USDC)"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                />
            </div>

            {/* Get Quote Button */}
            {!quote && (
                <Button
                    onClick={getQuote}
                    disabled={!isConnected || !amount || isGettingQuote}
                    variant="secondary"
                    className="w-full mb-4"
                >
                    {isGettingQuote ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Getting Quote...
                        </>
                    ) : (
                        "Get Bridge Quote"
                    )}
                </Button>
            )}

            {/* Quote Error */}
            {quoteError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-400">{quoteError}</p>
                </div>
            )}

            {/* Quote Display */}
            {quote && !bridgeTxHash && (
                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">You send</span>
                            <span className="text-white">{amount} USDC</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">You receive</span>
                            <span className="text-emerald-400">
                                ~{formatUnits(BigInt(quote.estimate.toAmount), 6)} USDC
                            </span>
                        </div>
                        {estimatedFees && (
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Est. fees</span>
                                <span>${estimatedFees.total}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm text-gray-500 mt-1">
                            <span>Bridge</span>
                            <span>{quote.tool}</span>
                        </div>
                    </div>

                    <Button
                        onClick={executeBridge}
                        disabled={isSending}
                        className="w-full"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Confirm in Wallet...
                            </>
                        ) : needsChainSwitch ? (
                            `Switch to ${SUPPORTED_SOURCE_CHAINS.find((c) => c.id === sourceChain)?.name}`
                        ) : (
                            "Bridge USDC"
                        )}
                    </Button>

                    <button
                        onClick={() => setQuote(null)}
                        className="text-sm text-gray-500 hover:text-gray-300 w-full text-center"
                    >
                        Get new quote
                    </button>
                </div>
            )}

            {/* Transaction Status */}
            {bridgeTxHash && (
                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        {/* Source Chain Transaction */}
                        <div className="flex items-center gap-2 mb-3">
                            {isConfirming ? (
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                            ) : isConfirmed ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                            )}
                            <span className="text-sm">
                                {isConfirming
                                    ? "Confirming on source chain..."
                                    : isConfirmed
                                        ? "Confirmed on source chain"
                                        : "Pending..."}
                            </span>
                        </div>

                        {/* Bridge Status */}
                        {bridgeStatus && (
                            <div className="flex items-center gap-2">
                                {bridgeStatus.status === "PENDING" ? (
                                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                ) : bridgeStatus.status === "DONE" ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                )}
                                <span className="text-sm">
                                    {bridgeStatus.status === "PENDING"
                                        ? `Bridging... ${bridgeStatus.substatus || ""}`
                                        : bridgeStatus.status === "DONE"
                                            ? "Bridge complete! USDC received on Base"
                                            : "Bridge failed"}
                                </span>
                            </div>
                        )}

                        {isPollingStatus && !bridgeStatus && (
                            <div className="flex items-center gap-2 text-amber-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Checking bridge status...</span>
                            </div>
                        )}
                    </div>

                    {/* Explorer Links */}
                    <div className="flex gap-2 text-xs">
                        <a
                            href={`https://etherscan.io/tx/${bridgeTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-400 hover:text-white"
                        >
                            View on Explorer <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                            href={`https://explorer.li.fi/transactions/${bridgeTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#0052FF] hover:text-[#1CD8D2]"
                        >
                            Track on LI.FI <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    {bridgeStatus?.status === "DONE" && (
                        <Button
                            onClick={() => {
                                clearStatusPolling();
                                setBridgeTxHash(null);
                                setBridgeStatus(null);
                                setIsPollingStatus(false);
                                setQuote(null);
                                setAmount("");
                            }}
                            variant="secondary"
                            className="w-full"
                        >
                            Bridge More
                        </Button>
                    )}
                </div>
            )}
        </SpotlightCard>
    );
}
