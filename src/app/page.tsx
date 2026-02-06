"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo, useState } from "react";
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

// Premium UI Components
import { DotBackground } from "@/components/ui/Backgrounds";
import { GradientText } from "@/components/ui/TextEffects";
import { Card } from "@/components/ui/Card";
import { Spotlight } from "@/components/ui/Spotlight";
import { ShieldCheck, Sparkles, Rocket, FileText, Search } from "lucide-react";
import { ShimmerButton } from "@/components/ui/MovingBorder";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Stepper, Step } from "@/components/campaign/Stepper";

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
  return { ok, words, nonSpaceChars };
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("confident, concise, onchain-native");
  const [cta, setCta] = useState("Try the demo");
  const [constraints, setConstraints] = useState("");

  const [aiBrief, setAiBrief] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);
  const [budgetNotes, setBudgetNotes] = useState("");
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [stepMode, setStepMode] = useState<StepMode>("inputs");
  const [lockedMetadataHash, setLockedMetadataHash] = useState<`0x${string}` | null>(
    null,
  );
  const [lockedCanonicalJson, setLockedCanonicalJson] = useState<string | null>(null);

  const [budgetUsdc, setBudgetUsdc] = useState("");
  const [publisher, setPublisher] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [campaignId, setCampaignId] = useState<string>("");

  const objectiveQuality = useMemo(() => analyzeObjective(objective), [objective]);

  const usdcAddress =
    (process.env.NEXT_PUBLIC_USDC as `0x${string}` | undefined) ??
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT as
    | `0x${string}`
    | undefined;

  const budgetUnits = useMemo(() => {
    try {
      if (!budgetUsdc) return null;
      return parseUnits(budgetUsdc, 6);
    } catch {
      return null;
    }
  }, [budgetUsdc]);

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

  const wrongChain = chainId !== BASE_SEPOLIA_CHAIN_ID;
  const canTransact = isConnected && !wrongChain && Boolean(vaultAddress);

  async function onGenerateBrief() {
    setBriefError(null);
    if (!objectiveQuality.ok) {
      setBriefError(
        "Objective is too short. Aim for >= 15 characters or >= 5 words (not just punctuation).",
      );
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
    if (!isAddress(publisher)) throw new Error("Invalid publisher address");
    if (!budgetUnits) throw new Error("Invalid budget");
    if (!lockedMetadataHash) throw new Error("Lock your AI brief to a hash first.");
    if (isDirtySinceLock) throw new Error("Brief changed since lock. Lock again.");

    const days = Number(deadlineDays);
    if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid deadline days");
    const deadline =
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(Math.floor(days * 86400));

    await writeContractAsync({
      address: vaultAddress,
      abi: campaignVaultAbi,
      functionName: "createCampaign",
      args: [publisher, budgetUnits, deadline, lockedMetadataHash],
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
    if (!campaignId) throw new Error("Campaign id required");
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
    if (!campaignId) throw new Error("Campaign id required");
    await writeContractAsync({
      address: vaultAddress,
      abi: campaignVaultAbi,
      functionName: "release",
      args: [BigInt(campaignId)],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });
  }

  const steps: Step[] = useMemo(() => {
    const isCreated = Boolean(createdCampaignId);
    return [
      {
        id: 1,
        title: "Create Campaign",
        description: "Draft & Lock Brief",
        status: isCreated ? "completed" : "active",
      },
      {
        id: 2,
        title: "Generate",
        description: "AI Content",
        status: isCreated ? "active" : "pending",
      },
      {
        id: 3,
        title: "Fund",
        description: "Escrow Budget",
        status: "pending",
      },
      {
        id: 4,
        title: "Release",
        description: "Milestones",
        status: "pending",
      },
    ];
  }, [createdCampaignId]);

  const currentStep = createdCampaignId ? 2 : 1;

  return (
    <DotBackground className="min-h-screen w-full relative overflow-hidden">
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 relative z-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-blue-600" /> {/* Logo placeholder if image not loaded */}
              <h1 className="text-xl font-bold tracking-tight text-white">Campaign Vault</h1>
            </div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">Base Sepolia • AI Agent</p>
          </div>
          <div className="pt-1">
            <ConnectButton />
          </div>
        </header>

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center gap-6 py-10">
          <div className="inline-flex items-center rounded-full border border-[var(--base-blue-light)]/30 bg-[var(--base-blue-dark)]/20 px-3 py-1 text-xs font-medium text-[var(--base-blue-light)] backdrop-blur-sm">
            ⚡ Built for Web3
          </div>

          <h2 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl">
            <span className="text-white">AI-Powered</span>{" "}
            <GradientText>Campaign Builder</GradientText>
          </h2>

          <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
            Launch campaigns with transparent onchain payments.
            AI generates the brief, you control the funds via smart contract vault.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-2">
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 text-sm text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> USDC Escrow
            </div>
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 text-sm text-zinc-400">
              <Sparkles className="w-4 h-4 text-purple-500" /> AI Content
            </div>
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 text-sm text-zinc-400">
              <Rocket className="w-4 h-4 text-blue-500" /> On-chain Release
            </div>
          </div>
        </div>

        <div className="py-2">
          <Stepper steps={steps} currentStep={currentStep} />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Campaign Form & AI Brief */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card className="p-6">
              <div className="mb-6 flex items-start gap-4 border-b border-white/5 pb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Campaign Details</h2>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Define your requirements. AI will generate a structured brief.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <Textarea
                  label="Campaign Objective"
                  placeholder="e.g., Drive 1,000 signups for Base App"
                  name="objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  disabled={stepMode === "brief"}
                  hint="Outcome + metric + timeframe (e.g., “Drive 1,000 signups in 14 days”)."
                />

                <div className="grid gap-6 sm:grid-cols-2">
                  <Input
                    label="Budget (USDC)"
                    placeholder="e.g., 500"
                    name="budget"
                    inputMode="decimal"
                    value={budgetUsdc}
                    onChange={(e) => setBudgetUsdc(e.target.value)}
                    disabled={stepMode === "brief"}
                    hint="Escrowed amount."
                    error={
                      stepMode === "inputs" && !budgetUsdc.trim()
                        ? "Recommended."
                        : undefined
                    }
                  />
                  <Input
                    label="Deadline (days)"
                    inputMode="numeric"
                    placeholder="7"
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(e.target.value)}
                    disabled={stepMode === "brief"}
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Input
                    label="Target Audience"
                    placeholder="e.g., Developers"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    disabled={stepMode === "brief"}
                  />
                  <Input
                    label="Tone of Voice"
                    placeholder="e.g., confident, concise"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    disabled={stepMode === "brief"}
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Input
                    label="Primary CTA"
                    placeholder="e.g., Mint Now"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    disabled={stepMode === "brief"}
                  />
                  <Input
                    label="Constraints"
                    placeholder="e.g., no paid ads"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    disabled={stepMode === "brief"}
                  />
                </div>

                <Input
                  label="Publisher Address"
                  placeholder="0x... or ens.eth"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="font-mono"
                  disabled={stepMode === "brief"}
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">AI Brief + Deliverables</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Review and edit the AI-generated brief before locking.
                  </p>
                  <div className="mt-2 text-xs text-zinc-500">
                    Mode:{" "}
                    <span className="font-medium text-zinc-400">
                      {stepMode === "inputs" ? "Inputs" : "Brief"}
                    </span>
                    {stepMode === "inputs"
                      ? " — generate a brief to start editing."
                      : " — edit deliverables, then lock to hash."}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <Button
                    isLoading={isGeneratingBrief}
                    disabled={
                      stepMode !== "inputs" || isGeneratingBrief || !objectiveQuality.ok
                    }
                    onClick={() => void onGenerateBrief()}
                  >
                    Generate Brief
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={stepMode !== "brief" || isGeneratingBrief}
                    onClick={onEditInputs}
                  >
                    Edit Inputs
                  </Button>
                </div>
              </div>

              {briefError ? (
                <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/40 p-3 text-sm text-red-200">
                  {briefError}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4">
                <Textarea
                  label="Brief"
                  placeholder="Generate a brief, then edit it here."
                  value={aiBrief}
                  onChange={(e) => setAiBrief(e.target.value)}
                  disabled={stepMode !== "brief"}
                />

                {budgetNotes ? (
                  <Textarea
                    label="Budget notes (optional)"
                    value={budgetNotes}
                    onChange={(e) => setBudgetNotes(e.target.value)}
                    disabled={stepMode !== "brief"}
                  />
                ) : null}

                <EditableList
                  title="Deliverables checklist"
                  items={deliverables}
                  setItems={setDeliverables}
                  placeholder="Add a deliverable…"
                  disabled={stepMode !== "brief"}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditableList
                    title="Do"
                    items={dos}
                    setItems={setDos}
                    placeholder="Add a do…"
                    disabled={stepMode !== "brief"}
                  />
                  <EditableList
                    title="Don't"
                    items={donts}
                    setItems={setDonts}
                    placeholder="Add a don't…"
                    disabled={stepMode !== "brief"}
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Contract Info & Actions */}
          <div className="flex flex-col gap-6">
            <Card className="sticky top-6 p-6">
              <div className="mb-6 flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <h3 className="font-semibold">Contract Info</h3>
              </div>

              <div className="space-y-4 rounded-xl border border-white/5 bg-zinc-950/50 p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">USDC Contract</span>
                  <span className="break-all font-mono text-xs text-zinc-400">{usdcAddress}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">Vault Contract</span>
                  <span className="break-all font-mono text-xs text-zinc-400">
                    {vaultAddress ?? "not configured"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">Allowance</span>
                  <span className="break-all font-mono text-xs text-zinc-400">
                    {allowanceQuery.data?.toString() ?? "0"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={stepMode !== "brief" || !currentMetadataHash || isGeneratingBrief}
                  onClick={onLockToHash}
                  className="w-full justify-center"
                >
                  Lock Brief to Hash
                </Button>

                <div className="my-2 h-px w-full bg-white/5" />

                <ActionButton
                  label="Create Campaign"
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
                  label="Deposit"
                  disabled={!canTransact}
                  busy={isPending}
                  onClick={onDeposit}
                />
                <ActionButton
                  label="Release"
                  disabled={!canTransact}
                  busy={isPending}
                  onClick={onRelease}
                />
              </div>

              {wrongChain ? (
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    disabled={isSwitching}
                    onClick={() => switchChain({ chainId: baseSepolia.id })}
                    className="w-full"
                  >
                    Switch to Base Sepolia
                  </Button>
                </div>
              ) : null}

              {/* Metadata Hash Status */}
              <div className="mt-4 rounded-lg bg-blue-500/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-400">Metadata Hash</span>
                  <span className="text-[10px] text-blue-500/70">
                    {lockedMetadataHash ? "LOCKED" : "UNLOCKED"}
                  </span>
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-blue-300/80">
                  {lockedMetadataHash ?? "Generate & Lock brief first"}
                </div>
              </div>

              {/* Transaction Status */}
              {lastHash ? (
                <div className="mt-4 rounded-lg bg-zinc-900 p-3">
                  <div className="text-xs text-zinc-400">Transaction</div>
                  <a
                    className="mt-1 block break-all font-mono text-[10px] text-blue-400 underline decoration-blue-400/30"
                    href={getExplorerTxUrl(lastHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {lastHash}
                  </a>
                  <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
                    <span className="text-[10px] text-zinc-500">Status</span>
                    <span className={cn("text-[10px] font-medium",
                      receipt.isSuccess ? "text-emerald-400" : "text-amber-400"
                    )}>
                      {receipt.isLoading ? "Pending" : receipt.isSuccess ? "Confirmed" : "Sent"}
                    </span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 text-xs text-red-400">
                  {error.message}
                </div>
              ) : null}

            </Card>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 opacity-60 hover:opacity-100 transition-opacity">
          <FlowCard
            step="01"
            title="Create"
            description="Define objective & lock brief."
            cta="Start"
          />
          <FlowCard
            step="02"
            title="Generate"
            description="AI creates content."
            cta="Auto"
          />
          <FlowCard
            step="03"
            title="Fund"
            description="Escrow budget onchain."
            cta="Fund"
          />
          <FlowCard
            step="04"
            title="Release"
            description="Approve & payout."
            cta="Pay"
          />
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-8 text-center text-sm text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>
            &copy; 2026 Campaign Vault Agent. Built on <span className="text-blue-500">Base</span> with <span className="text-purple-500">AI</span>.
          </p>
          <div className="flex justify-center gap-6 sm:justify-end">
            <a href="#" className="hover:text-white transition-colors">Github</a>
            <a href="#" className="hover:text-white transition-colors">Docs</a>
          </div>
        </footer>
      </main>
    </DotBackground>
  );
}

function FlowCard(props: {
  step: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium tracking-wider text-[var(--muted-foreground)]">
            {props.step}
          </div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            {props.description}
          </p>
        </div>
        <Button variant="secondary" size="sm">
          {props.cta}
        </Button>
      </div>
    </Card>
  );
}

function ActionButton(props: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <Button
      variant="primary"
      isLoading={props.busy}
      disabled={props.disabled}
      onClick={() => void props.onClick()}
      className="w-full"
    >
      {props.label}
    </Button>
  );
}

function EditableList(props: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{props.title}</div>
        <Button
          variant="secondary"
          size="sm"
          disabled={props.disabled}
          onClick={() => props.setItems([...props.items, ""])}
        >
          Add
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {props.items.length === 0 ? (
          <div className="text-sm text-[var(--muted-foreground)]">
            {props.placeholder}
          </div>
        ) : null}
        {props.items.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="flex-1"
              placeholder={props.placeholder}
              value={item}
              disabled={props.disabled}
              onChange={(e) => {
                const next = props.items.slice();
                next[idx] = e.target.value;
                props.setItems(next);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={props.disabled}
              onClick={() => {
                const next = props.items.filter((_, i) => i !== idx);
                props.setItems(next);
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
