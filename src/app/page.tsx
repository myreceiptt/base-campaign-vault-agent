"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import {
  decodeEventLog,
  isAddress,
  keccak256,
  parseUnits,
  toHex,
  zeroAddress,
} from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { campaignVaultAbi } from "@/lib/abi/campaignVault";
import { erc20Abi } from "@/lib/abi/erc20";
import { BASE_SEPOLIA_CHAIN_ID, getExplorerTxUrl } from "@/lib/onchain";
import type { Json } from "@/lib/stableJson";
import { stableStringify } from "@/lib/stableJson";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

// UI Components
import { DotBackground } from "@/components/ui/Backgrounds";
import { SpotlightCard, Spotlight } from "@/components/ui/Spotlight";
import { GradientText } from "@/components/ui/TextEffects";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ShimmerButton } from "@/components/ui/MovingBorder";
import {
  FileText,
  Sparkles,
  Rocket,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  Lock,
} from "lucide-react";

type BriefResponse = {
  brief: string;
  deliverables: string[];
  do: string[];
  dont: string[];
  budgetNotes?: string;
};

type StepMode = "inputs" | "brief";

function analyzeObjective(text: string) {
  const trimmed = text.trim();
  const hasAlphaNum = /[\p{L}\p{N}]/u.test(trimmed);
  const words = trimmed
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const nonSpaceChars = trimmed.replace(/\s+/g, "").length;

  const ok = hasAlphaNum && (nonSpaceChars >= 15 || words >= 5);
  return { ok, charCount: nonSpaceChars, wordCount: words };
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // Form state
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [budgetUsdc, setBudgetUsdc] = useState("");
  const [tone, setTone] = useState("confident, concise, onchain-native");
  const [cta, setCta] = useState("Try the demo");
  const [constraints, setConstraints] = useState("");
  const [publisher, setPublisher] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [campaignId, setCampaignId] = useState<string>("");

  // AI Brief state
  const [stepMode, setStepMode] = useState<StepMode>("inputs");
  const [aiBrief, setAiBrief] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);
  const [budgetNotes, setBudgetNotes] = useState("");
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [lockedMetadataHash, setLockedMetadataHash] = useState<`0x${string}` | null>(null);
  const [lockedCanonicalJson, setLockedCanonicalJson] = useState<string | null>(null);
  const [showCanonicalJson, setShowCanonicalJson] = useState(false);

  // Contract addresses
  const usdcAddress =
    (process.env.NEXT_PUBLIC_USDC as `0x${string}` | undefined) ??
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT as
    | `0x${string}`
    | undefined;

  const objectiveQuality = useMemo(() => analyzeObjective(objective), [objective]);

  const budgetUnits = useMemo(() => {
    try {
      if (!budgetUsdc) return null;
      return parseUnits(budgetUsdc, 6);
    } catch {
      return null;
    }
  }, [budgetUsdc]);

  // Compute the full campaign brief payload for metadataHash
  const currentBriefPayload = useMemo(() => {
    const payload: Record<string, Json> = {
      objective,
      audience,
      tone,
      cta,
      constraints,
      brief: aiBrief,
      deliverables,
      do: dos,
      dont: donts,
    };
    if (budgetNotes.trim()) payload.budgetNotes = budgetNotes.trim();
    return payload;
  }, [objective, audience, tone, cta, constraints, aiBrief, deliverables, dos, donts, budgetNotes]);

  const canonicalBriefJson = useMemo(() => {
    return stableStringify(currentBriefPayload);
  }, [currentBriefPayload]);

  const currentMetadataHash = useMemo(() => {
    if (!objective.trim()) return null;
    return keccak256(toHex(canonicalBriefJson));
  }, [objective, canonicalBriefJson]);

  const isDirtySinceLock = useMemo(() => {
    if (!lockedMetadataHash) return false;
    return lockedMetadataHash !== currentMetadataHash;
  }, [lockedMetadataHash, currentMetadataHash]);

  const allowanceEnabled = Boolean(isConnected && address && vaultAddress);
  const allowanceArgs = allowanceEnabled
    ? ([address!, vaultAddress!] as const)
    : ([zeroAddress, zeroAddress] as const);

  const allowanceQuery = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: allowanceArgs,
    query: {
      enabled: allowanceEnabled,
    },
  });

  const { writeContractAsync, data: lastHash, isPending, error } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: lastHash,
    query: { enabled: Boolean(lastHash) },
  });

  const createdCampaignId = useMemo(() => {
    if (!receipt.data) return null;
    for (const log of receipt.data.logs) {
      try {
        const decoded = decodeEventLog({
          abi: campaignVaultAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "CampaignCreated") {
          return decoded.args.campaignId.toString();
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, [receipt.data]);

  useEffect(() => {
    if (createdCampaignId) {
      setCampaignId(createdCampaignId);
    }
  }, [createdCampaignId]);

  const wrongChain = chainId !== BASE_SEPOLIA_CHAIN_ID;
  const canTransact = isConnected && !wrongChain && Boolean(vaultAddress);

  // AI Brief generation
  async function onGenerateBrief() {
    setBriefError(null);
    if (!objectiveQuality.ok) {
      setBriefError("Objective is too short. Aim for >= 15 characters or >= 5 words.");
      return;
    }

    setIsGeneratingBrief(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objective,
          audience,
          tone,
          cta,
          constraints,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const json = (await res.json()) as BriefResponse;
      setAiBrief(json.brief ?? "");
      setDeliverables(Array.isArray(json.deliverables) ? json.deliverables : []);
      setDos(Array.isArray(json.do) ? json.do : []);
      setDonts(Array.isArray(json.dont) ? json.dont : []);
      setBudgetNotes(json.budgetNotes ?? "");
      setStepMode("brief");
    } catch (err) {
      setBriefError((err as Error).message);
    } finally {
      setIsGeneratingBrief(false);
    }
  }

  function onEditInputs() {
    setStepMode("inputs");
    setBriefError(null);
    setLockedMetadataHash(null);
    setLockedCanonicalJson(null);
    setAiBrief("");
    setDeliverables([]);
    setDos([]);
    setDonts([]);
    setBudgetNotes("");
  }

  function onLockToHash() {
    setBriefError(null);
    if (!objective.trim()) {
      setBriefError("Objective is required before locking.");
      return;
    }
    if (!currentMetadataHash) {
      setBriefError("Unable to compute metadataHash.");
      return;
    }

    setLockedMetadataHash(currentMetadataHash);
    setLockedCanonicalJson(canonicalBriefJson);
  }

  async function onCreateCampaign() {
    if (!vaultAddress) return;
    if (!lockedMetadataHash) throw new Error("Lock your AI brief to a hash first.");
    if (isDirtySinceLock) throw new Error("Brief changed since lock. Lock again.");
    if (!budgetUnits) throw new Error("Invalid budget");

    const days = Number(deadlineDays);
    if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid deadline days");
    const deadline =
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(Math.floor(days * 86400));

    await writeContractAsync({
      address: vaultAddress,
      abi: campaignVaultAbi,
      functionName: "createCampaign",
      args: [publisher && isAddress(publisher) ? publisher : zeroAddress, budgetUnits, deadline, lockedMetadataHash],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });
  }

  async function onApproveUsdc() {
    if (!vaultAddress) return;
    if (!budgetUnits) throw new Error("Invalid budget");
    await writeContractAsync({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [vaultAddress, budgetUnits],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });
  }

  async function onDeposit() {
    if (!vaultAddress) return;
    if (!campaignId) throw new Error("Campaign ID required");
    await writeContractAsync({
      address: vaultAddress,
      abi: campaignVaultAbi,
      functionName: "deposit",
      args: [BigInt(campaignId)],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });
  }

  async function onRelease() {
    if (!vaultAddress) return;
    if (!campaignId) throw new Error("Campaign ID required");
    await writeContractAsync({
      address: vaultAddress,
      abi: campaignVaultAbi,
      functionName: "release",
      args: [BigInt(campaignId)],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-hidden">
      <Spotlight className="left-0 -top-40 md:left-60 md:-top-20" fill="#0052FF" />

      <DotBackground className="min-h-screen">
        {/* Header */}
        <header className="border-b border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <Image
                  src="/logo-v2.png"
                  alt="Base Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold">Campaign Vault</h1>
                <p className="text-xs text-gray-500">Base Sepolia • AI Agent</p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-12 text-center">
          <div className="inline-flex items-center rounded-full border border-[#0052FF]/30 bg-[#0052FF]/10 px-4 py-1.5 text-sm font-medium text-[#0052FF] mb-6">
            ⚡ Built for Web3
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-white">AI-Powered </span>
            <GradientText>Campaign Builder</GradientText>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            Launch campaigns with transparent onchain payments. AI generates the brief, you control the funds via smart contract vault.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> USDC Escrow
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <Sparkles className="w-4 h-4 text-purple-500" /> AI Content
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <Rocket className="w-4 h-4 text-blue-500" /> On-chain Release
            </div>
          </div>
        </section>

        {/* Main Content - 2 Column Layout */}
        <main className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column: Form + AI Brief */}
            <div className="lg:col-span-2 space-y-6">
              {/* Campaign Details Card */}
              <SpotlightCard className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Campaign Details</h3>
                    <p className="text-sm text-gray-500">Define your requirements. AI will generate a structured brief.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Textarea
                      label="Campaign objective"
                      placeholder="e.g., Drive 1,000 signups for Base App"
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      disabled={stepMode === "brief"}
                      hint='Outcome + metric + timeframe (e.g., "Drive 1,000 signups in 14 days").'
                    />
                    <Input
                      label="Audience"
                      placeholder="e.g., Developers"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      disabled={stepMode === "brief"}
                      hint='Role + stage + context (e.g., "Indie devs pre-launch on Base").'
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Primary CTA"
                      placeholder="e.g., Mint Now"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      disabled={stepMode === "brief"}
                      hint='One action (e.g., "Try the demo", "Sign up", "Mint").'
                    />
                    <Input
                      label="Tone"
                      placeholder="e.g., confident, concise"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      disabled={stepMode === "brief"}
                      hint='2–3 adjectives (e.g., "confident, concise, playful").'
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Constraints"
                      placeholder="e.g., no paid ads"
                      value={constraints}
                      onChange={(e) => setConstraints(e.target.value)}
                      disabled={stepMode === "brief"}
                      hint='Hard rules (e.g., "no paid influencers", "2-week timeline").'
                    />
                    <Input
                      label="Budget (USDC)"
                      placeholder="e.g., 500"
                      inputMode="decimal"
                      value={budgetUsdc}
                      onChange={(e) => setBudgetUsdc(e.target.value)}
                      disabled={stepMode === "brief"}
                      hint='Number only (e.g., "500" = 500 USDC escrowed onchain).'
                    />
                  </div>

                  <p className="text-xs text-gray-500 pt-2">
                    Polite AI workflow: generate suggestions → edit → lock to hash → sign the onchain tx.
                  </p>
                </div>
              </SpotlightCard>

              {/* AI Brief + Deliverables Card */}
              <SpotlightCard className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">AI Brief + Deliverables</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      The AI suggests. You can edit everything before locking it into `metadataHash`.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Mode: <span className="font-medium text-gray-400">{stepMode === "inputs" ? "Inputs" : "Brief"}</span>
                      {stepMode === "inputs" ? " — generate a brief to start editing." : " — edit deliverables, then lock to hash."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ShimmerButton
                      disabled={stepMode !== "inputs" || isGeneratingBrief || !objectiveQuality.ok}
                      onClick={() => void onGenerateBrief()}
                    >
                      {isGeneratingBrief ? "Generating..." : "Generate Brief"}
                    </ShimmerButton>
                    <Button
                      variant="secondary"
                      disabled={stepMode !== "brief" || isGeneratingBrief}
                      onClick={onEditInputs}
                    >
                      Edit Inputs
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={stepMode !== "brief" || !currentMetadataHash || isGeneratingBrief}
                      onClick={onLockToHash}
                    >
                      <Lock className="w-4 h-4 mr-1" />
                      Lock to Hash
                    </Button>
                  </div>
                </div>

                {briefError && (
                  <div className="mb-4 p-3 rounded-xl border border-red-900/40 bg-red-950/40 text-sm text-red-200">
                    {briefError}
                  </div>
                )}

                <div className="space-y-4">
                  <Textarea
                    label="Brief"
                    placeholder="Generate a brief, then edit it here."
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    disabled={stepMode !== "brief"}
                  />

                  {budgetNotes && (
                    <Textarea
                      label="Budget notes (optional)"
                      value={budgetNotes}
                      onChange={(e) => setBudgetNotes(e.target.value)}
                      disabled={stepMode !== "brief"}
                    />
                  )}

                  <EditableList
                    title="Deliverables checklist"
                    items={deliverables}
                    setItems={setDeliverables}
                    placeholder="Add a deliverable..."
                    disabled={stepMode !== "brief"}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditableList
                      title="Do"
                      items={dos}
                      setItems={setDos}
                      placeholder="Add a do..."
                      disabled={stepMode !== "brief"}
                    />
                    <EditableList
                      title="Don't"
                      items={donts}
                      setItems={setDonts}
                      placeholder="Add a don't..."
                      disabled={stepMode !== "brief"}
                    />
                  </div>
                </div>

                {/* metadataHash Display */}
                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">metadataHash (locked)</span>
                    <span className="text-xs text-gray-500">
                      {lockedMetadataHash ? "Ready to sign." : "Lock brief first."}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 font-mono break-all">
                    {lockedMetadataHash ?? "Generate & Lock brief first"}
                  </p>

                  {lockedCanonicalJson && (
                    <div className="mt-3">
                      <button
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition"
                        onClick={() => setShowCanonicalJson(!showCanonicalJson)}
                      >
                        <ChevronDown className={cn("w-4 h-4 transition-transform", showCanonicalJson && "rotate-180")} />
                        View canonical JSON (locked)
                      </button>
                      {showCanonicalJson && (
                        <pre className="mt-2 p-3 rounded-lg bg-black/40 text-xs text-gray-400 overflow-x-auto max-h-40">
                          {JSON.stringify(JSON.parse(lockedCanonicalJson), null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </SpotlightCard>
            </div>

            {/* Right Column: Campaign Summary */}
            <div className="space-y-6">
              <AnimatePresence>
                {(objective || budgetUsdc || audience || tone || cta || constraints) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    <SpotlightCard className="p-6 sticky top-6">
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#1CD8D2]" />
                        Campaign Summary
                      </h4>
                      <div className="space-y-4 text-sm">
                        {objective && (
                          <div>
                            <p className="text-gray-500 mb-1">Objective</p>
                            <p className="text-gray-200 line-clamp-2">{objective}</p>
                          </div>
                        )}
                        {audience && (
                          <div>
                            <p className="text-gray-500 mb-1">Audience</p>
                            <p className="text-gray-200 line-clamp-2">{audience}</p>
                          </div>
                        )}
                        {cta && (
                          <div>
                            <p className="text-gray-500 mb-1">Primary CTA</p>
                            <p className="text-gray-200">{cta}</p>
                          </div>
                        )}
                        {tone && (
                          <div>
                            <p className="text-gray-500 mb-1">Tone</p>
                            <p className="text-gray-200">{tone}</p>
                          </div>
                        )}
                        {constraints && (
                          <div>
                            <p className="text-gray-500 mb-1">Constraints</p>
                            <p className="text-gray-200 line-clamp-2">{constraints}</p>
                          </div>
                        )}
                        {budgetUsdc && (
                          <div>
                            <p className="text-gray-500 mb-1">Budget</p>
                            <p className="text-2xl font-bold bg-gradient-to-r from-[#0052FF] to-[#1CD8D2] bg-clip-text text-transparent">{budgetUsdc} USDC</p>
                          </div>
                        )}
                      </div>
                    </SpotlightCard>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Onchain Actions Section */}
        <section className="mx-auto max-w-6xl px-6 pb-8">
          <SpotlightCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold">Onchain (Base Sepolia)</h3>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-gray-500">USDC:</span>{" "}
                    <span className="font-mono text-gray-400 break-all">{usdcAddress}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Vault:</span>{" "}
                    <span className="font-mono text-gray-400 break-all">{vaultAddress ?? "not configured"}</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Publisher address"
                    placeholder="0x... or ens.eth"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Input
                    label="Deadline (days)"
                    inputMode="numeric"
                    placeholder="7"
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Campaign ID"
                    placeholder="Auto-filled after create"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="font-mono"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Allowance</label>
                    <p className="text-sm text-gray-300">{allowanceQuery.data?.toString() ?? "0"}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">metadataHash:</label>
                  <p className="text-xs font-mono text-gray-500 break-all">
                    {lockedMetadataHash ?? currentMetadataHash ?? "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <ActionButton
                    label="Create campaign"
                    disabled={!canTransact || !lockedMetadataHash || isDirtySinceLock}
                    busy={isPending}
                    onClick={onCreateCampaign}
                  />
                  <ActionButton
                    label="Approve USDC"
                    disabled={!canTransact}
                    busy={isPending}
                    onClick={onApproveUsdc}
                  />
                  <ActionButton
                    label="Deposit USDC"
                    disabled={!canTransact || !campaignId}
                    busy={isPending}
                    onClick={onDeposit}
                  />
                  <ActionButton
                    label="Release"
                    disabled={!canTransact || !campaignId}
                    busy={isPending}
                    onClick={onRelease}
                  />
                </div>

                {wrongChain && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={isSwitching}
                    onClick={() => switchChain({ chainId: baseSepolia.id })}
                  >
                    Switch to Base Sepolia
                  </Button>
                )}

                {/* Transaction Status */}
                {lastHash && (
                  <div className="rounded-lg bg-zinc-900/80 p-3">
                    <div className="text-xs text-gray-500">Transaction</div>
                    <a
                      className="mt-1 block font-mono text-xs text-blue-400 underline break-all"
                      href={getExplorerTxUrl(lastHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {lastHash}
                    </a>
                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
                      <span className="text-xs text-gray-500">Status</span>
                      <span className={cn("text-xs font-medium",
                        receipt.isSuccess ? "text-emerald-400" : receipt.isError ? "text-red-400" : "text-amber-400"
                      )}>
                        {receipt.isLoading ? "Pending" : receipt.isSuccess ? "Confirmed" : receipt.isError ? "Error" : "Sent"}
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-xs text-red-400">
                    {error.message.split("\n")[0]}
                  </div>
                )}
              </div>
            </div>
          </SpotlightCard>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                © 2026 Campaign Vault Agent. Built on <span className="text-[#0052FF]">Base</span> with <span className="text-purple-500">AI</span>.
              </p>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <a href="https://github.com/myreceiptt/base-campaign-vault-agent" target="_blank" rel="noreferrer" className="hover:text-white transition">
                  Github
                </a>
              </div>
            </div>
          </div>
        </footer>
      </DotBackground>
    </div>
  );
}

// EditableList component
function EditableList(props: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{props.title}</span>
        <button
          className="px-3 py-1 rounded-lg bg-white/10 text-xs font-medium hover:bg-white/20 transition disabled:opacity-50"
          disabled={props.disabled}
          onClick={() => props.setItems([...props.items, ""])}
        >
          Add
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {props.items.length === 0 && (
          <p className="text-xs text-gray-500">{props.placeholder}</p>
        )}
        {props.items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              className="flex-1 text-sm"
              placeholder={props.placeholder}
              value={item}
              disabled={props.disabled}
              onChange={(e) => {
                const next = props.items.slice();
                next[idx] = e.target.value;
                props.setItems(next);
              }}
            />
            <button
              className="px-2 py-1 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition disabled:opacity-50"
              disabled={props.disabled}
              onClick={() => props.setItems(props.items.filter((_, i) => i !== idx))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ActionButton component
function ActionButton(props: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <Button
      variant="secondary"
      isLoading={props.busy}
      disabled={props.disabled}
      onClick={() => void props.onClick()}
      className="w-full justify-center text-xs"
    >
      {props.label}
    </Button>
  );
}
