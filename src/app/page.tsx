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
import { useToast } from "@/contexts/ToastContext";
import { AnimatePresence, motion } from "framer-motion";

// UI Components
import { Stepper, Step } from "@/components/campaign/Stepper";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { ENSInput } from "@/components/ui/ENSInput";

// Aceternity-inspired Components
import { DotBackground } from "@/components/ui/Backgrounds";
import { SpotlightCard, Spotlight } from "@/components/ui/Spotlight";
import { ShimmerButton, MovingBorder } from "@/components/ui/MovingBorder";
import { GradientText, FlipWords } from "@/components/ui/TextEffects";

import {
  FileEdit,
  Wallet,
  Sparkles,
  Rocket,
  AlertCircle,
  ExternalLink,
  CheckCircle,
  Clock,
  DollarSign,
  Zap,
  Shield,
  ArrowRight
} from "lucide-react";

// Step Configuration
// Step Configuration
const STEP_CONFIG = [
  {
    id: 1,
    title: "Create",
    description: "Define campaign",
    icon: <div className="relative w-8 h-8"><Image src="/icon-create.png" alt="Create" fill className="object-contain mix-blend-screen" /></div>
  },
  {
    id: 2,
    title: "Generate",
    description: "AI content",
    icon: <div className="relative w-8 h-8"><Image src="/icon-generate.png" alt="Generate" fill className="object-contain mix-blend-screen" /></div>
  },
  {
    id: 3,
    title: "Fund",
    description: "Deposit USDC",
    icon: <div className="relative w-8 h-8"><Image src="/icon-fund.png" alt="Fund" fill className="object-contain mix-blend-screen" /></div>
  },
  {
    id: 4,
    title: "Release",
    description: "Complete",
    icon: <div className="relative w-8 h-8"><Image src="/icon-release.png" alt="Release" fill className="object-contain mix-blend-screen" /></div>
  },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
    filter: "blur(10px)",
    scale: 0.95,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0,
    filter: "blur(10px)",
    scale: 0.95,
  }),
};

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();

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
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);

  // Contract addresses
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

  const metadataHash = useMemo(() => {
    if (!objective) return null;
    return keccak256(toHex(objective));
  }, [objective]);

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

  // Watch for transaction errors and successes using Toasts
  useEffect(() => {
    if (error) {
      toastError(error.message.split("\n")[0] || "Transaction failed");
    }
  }, [error, toastError]);

  useEffect(() => {
    if (receipt.isSuccess && lastHash) {
      toastSuccess("Transaction confirmed on-chain!");
    }
  }, [receipt.isSuccess, lastHash, toastSuccess]);

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

  // Set next step when campaign is created
  useEffect(() => {
    if (createdCampaignId) {
      setCampaignId(createdCampaignId);
      setDirection(1);
      setCurrentStep(2);
      toastSuccess(`Campaign #${createdCampaignId} created successfully!`);
    }
  }, [createdCampaignId, toastSuccess]);

  const wrongChain = chainId !== BASE_SEPOLIA_CHAIN_ID;
  const canTransact = isConnected && !wrongChain && Boolean(vaultAddress);

  // Get step statuses based on current progress
  const steps: Step[] = STEP_CONFIG.map((step) => ({
    ...step,
    status:
      step.id < currentStep
        ? "completed"
        : step.id === currentStep
          ? "active"
          : "pending",
  }));

  const handleStepChange = (newStep: number) => {
    if (newStep <= currentStep) {
      setDirection(newStep > currentStep ? 1 : -1);
      setCurrentStep(newStep);
    }
  };

  async function onCreateCampaign() {
    try {
      if (!vaultAddress) {
        toastError("Vault contract address not configured");
        return;
      }
      if (!address) throw new Error("Wallet not connected");
      if (!budgetUnits) throw new Error("Invalid budget amount");
      if (!metadataHash) throw new Error("Campaign objective required");

      const days = Number(deadlineDays);
      if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid deadline days");
      const deadline =
        BigInt(Math.floor(Date.now() / 1000)) + BigInt(Math.floor(days * 86400));

      // Use connected wallet address as default publisher
      const publisherAddress = publisher && isAddress(publisher) ? publisher : address;

      await writeContractAsync({
        address: vaultAddress,
        abi: campaignVaultAbi,
        functionName: "createCampaign",
        args: [publisherAddress, budgetUnits, deadline, metadataHash],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });
      toastInfo("Transaction submitted! Waiting for confirmation...");
    } catch (err: any) {
      toastError(err.message || "Failed to create campaign");
    }
  }

  async function onApproveUsdc() {
    try {
      if (!vaultAddress) return;
      if (!budgetUnits) throw new Error("Invalid budget");
      await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress, budgetUnits],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });
      toastInfo("Approval submitted! Waiting for confirmation...");
    } catch (err: any) {
      toastError(err.message || "Failed to approve USDC");
    }
  }

  async function onDeposit() {
    try {
      if (!vaultAddress) return;
      if (!campaignId) throw new Error("Campaign ID required");
      await writeContractAsync({
        address: vaultAddress,
        abi: campaignVaultAbi,
        functionName: "deposit",
        args: [BigInt(campaignId)],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });
      toastInfo("Deposit submitted! Waiting for confirmation...");

      // We will move to next step when transaction confirms, but for UX flow we can assume user wants to proceed
      // setDirection(1);
      // setCurrentStep(3);
    } catch (err: any) {
      toastError(err.message || "Failed to deposit USDC");
    }
  }

  // Effect to move to next step on successful deposit
  useEffect(() => {
    if (currentStep === 2 && receipt.isSuccess && lastHash) {
      // This is a naive check; ideally we check which function was called, but for now this works for demo flow
      setDirection(1);
      setCurrentStep(3);
    }
  }, [currentStep, receipt.isSuccess, lastHash]);

  async function onRelease() {
    try {
      if (!vaultAddress) return;
      if (!campaignId) throw new Error("Campaign ID required");
      await writeContractAsync({
        address: vaultAddress,
        abi: campaignVaultAbi,
        functionName: "release",
        args: [BigInt(campaignId)],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });
      toastInfo("Release submitted! Waiting for confirmation...");

      // setDirection(1);
      // setCurrentStep(4);
    } catch (err: any) {
      toastError(err.message || "Failed to release funds");
    }
  }

  // Effect to move to next step on successful release
  useEffect(() => {
    if (currentStep === 4 && receipt.isSuccess && lastHash) {
      toastSuccess("Funds released successfully! Campaign completed.");
    }
  }, [currentStep, receipt.isSuccess, lastHash, toastSuccess]);

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-hidden">
      {/* Spotlight Effect */}
      <Spotlight
        className="left-0 -top-40 md:left-60 md:-top-20"
        fill="#0052FF"
      />

      <DotBackground
        className="min-h-screen"
        dotColor="rgba(59, 130, 246, 0.3)"
        bgColor="transparent"
      >
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#030712]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0052FF]/20 to-[#1CD8D2]/20 flex items-center justify-center animate-glow-pulse border border-[#0052FF]/30">
                  <Image src="/logo-new.png" alt="Logo" width={24} height={24} className="object-contain opacity-90 mix-blend-screen" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Campaign Vault</h1>
                <p className="text-xs text-gray-500">Base Sepolia • AI Agent</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {wrongChain && isConnected && (
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={isSwitching}
                  onClick={() => switchChain({ chainId: baseSepolia.id })}
                >
                  Switch Network
                </Button>
              )}
              <ConnectButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-12">
          {/* Hero Section */}
          <section className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <Zap className="w-4 h-4 text-[#1CD8D2]" />
              <span className="text-gray-400">Built for</span>
              <FlipWords
                words={["Base", "Creators", "Brands", "Web3"]}
                className="text-[#0052FF] font-semibold"
              />
            </div>

            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl mb-6">
              <span className="gradient-text-hero">AI-Powered</span>
              <br />
              Campaign Builder
            </h2>

            <p className="text-gray-400 max-w-2xl mx-auto text-lg mb-8">
              Create marketing campaigns with USDC escrow for transparent, trustless payments.
              AI generates ready-to-post content while smart contracts secure your funds.
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                <Shield className="w-4 h-4 text-[#10B981]" />
                <span className="text-sm text-gray-300">USDC Escrow</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                <Sparkles className="w-4 h-4 text-[#0052FF]" />
                <span className="text-sm text-gray-300">AI Content</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                <Rocket className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-sm text-gray-300">On-chain Release</span>
              </div>
            </div>
          </section>

          {/* Stepper */}
          <section className="mb-12">
            <MovingBorder
              className="p-6 bg-[#030712]/60 backdrop-blur-xl"
              containerClassName="w-full"
              colors={["#0052FF", "#1CD8D2", "#93EDC7", "#0052FF"]}
            >
              <Stepper
                steps={steps}
                currentStep={currentStep}
                onStepClick={handleStepChange}
              />
            </MovingBorder>
          </section>

          {/* Main Content */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Form Area */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait" custom={direction}>
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.4, ease: "anticipate" }}
                  >
                    <SpotlightCard className="p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#1CD8D2] flex items-center justify-center">
                          <FileEdit className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Create Campaign</h3>
                          <p className="text-sm text-gray-400">
                            Define your objective, budget, and timeline
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-6">
                        {/* Row 1: Campaign Objective + Audience */}
                        <div className="grid gap-6 sm:grid-cols-2">
                          <Input
                            label="Campaign objective"
                            placeholder="e.g., Drive 1,000 signups for Base App"
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                            hint='Outcome + metric + timeframe (e.g., "Drive 1,000 signups in 14 days").'
                          />
                          <Input
                            label="Audience"
                            placeholder="e.g., Base App creators shipping weekly"
                            value={audience}
                            onChange={(e) => setAudience(e.target.value)}
                            hint='Role + stage + context (e.g., "Indie devs pre-launch on Base"). Recommended: add who this is for.'
                          />
                        </div>

                        {/* Row 2: Primary CTA + Tone */}
                        <div className="grid gap-6 sm:grid-cols-2">
                          <Input
                            label="Primary CTA"
                            placeholder="Try the demo"
                            value={cta}
                            onChange={(e) => setCta(e.target.value)}
                            hint='One action (e.g., "Try the demo", "Sign up", "Mint").'
                          />
                          <Input
                            label="Tone"
                            placeholder="confident, concise, onchain-native"
                            value={tone}
                            onChange={(e) => setTone(e.target.value)}
                            hint='2–3 adjectives (e.g., "confident, concise, playful").'
                          />
                        </div>

                        {/* Row 3: Constraints + Budget */}
                        <div className="grid gap-6 sm:grid-cols-2">
                          <div>
                            <Input
                              label="Constraints"
                              placeholder="e.g., no paid influencers; 2-week timeline; no AI claims"
                              value={constraints}
                              onChange={(e) => setConstraints(e.target.value)}
                              hint='Hard rules (e.g., "no paid influencers", "2-week timeline").'
                            />
                            <p className="mt-1 text-xs text-gray-500">Recommended: add any hard rules.</p>
                          </div>
                          <div>
                            <Input
                              label="Budget (USDC)"
                              placeholder="e.g., 500"
                              inputMode="decimal"
                              value={budgetUsdc}
                              onChange={(e) => setBudgetUsdc(e.target.value)}
                              hint='Number only (e.g., "500" = 500 USDC escrowed onchain).'
                            />
                            <p className="mt-1 text-xs text-gray-500">Recommended: set an escrow amount.</p>
                          </div>
                        </div>

                        {/* Workflow hint */}
                        <p className="text-sm text-gray-500">
                          Polite AI workflow: generate suggestions → edit → lock to hash → sign the onchain tx.
                        </p>

                        <div className="pt-4">
                          <ShimmerButton
                            onClick={onCreateCampaign}
                            disabled={!canTransact || !objective || !budgetUnits || isPending}
                            className="w-full"
                          >
                            {isPending ? (
                              <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating...
                              </span>
                            ) : (
                              <>
                                Create Campaign
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </ShimmerButton>
                        </div>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.4, ease: "anticipate" }}
                  >
                    <SpotlightCard className="p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B981] to-[#1CD8D2] flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Fund Campaign</h3>
                          <p className="text-sm text-gray-400">
                            Approve and deposit USDC into escrow
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-6">
                        <Input
                          label="Campaign ID"
                          placeholder={createdCampaignId ?? "e.g., 1"}
                          value={campaignId}
                          onChange={(e) => setCampaignId(e.target.value)}
                        />

                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400">Current Allowance</span>
                            <span className="font-mono text-sm">{allowanceQuery.data?.toString() ?? "0"} USDC</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Budget to Deposit</span>
                            <span className="font-mono font-semibold text-[#1CD8D2]">{budgetUsdc || "0"} USDC</span>
                          </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                          <Button
                            variant="secondary"
                            onClick={onApproveUsdc}
                            isLoading={isPending}
                            disabled={!canTransact || !budgetUnits}
                            className="flex-1"
                          >
                            Approve USDC
                          </Button>
                          <ShimmerButton
                            onClick={onDeposit}
                            disabled={!canTransact || !campaignId || isPending}
                            className="flex-1"
                            background="linear-gradient(135deg, #10B981 0%, #059669 100%)"
                          >
                            Deposit USDC
                            <ArrowRight className="w-4 h-4" />
                          </ShimmerButton>
                        </div>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.4, ease: "anticipate" }}
                  >
                    <SpotlightCard className="p-8">
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="relative mb-8">
                          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#1CD8D2] flex items-center justify-center animate-float">
                            <Sparkles className="w-12 h-12 text-white" />
                          </div>
                          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#0052FF]/20 to-[#1CD8D2]/20 blur-xl -z-10" />
                        </div>

                        <h3 className="text-2xl font-bold mb-3">
                          <GradientText>AI Content Generation</GradientText>
                        </h3>
                        <p className="text-gray-400 max-w-md mb-8">
                          Coming soon! The AI agent will analyze your campaign objective and generate
                          ready-to-post content for various social platforms.
                        </p>

                        <ShimmerButton onClick={() => {
                          setDirection(1);
                          setCurrentStep(4);
                        }}>
                          Continue to Release
                          <ArrowRight className="w-4 h-4" />
                        </ShimmerButton>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                )}

                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.4, ease: "anticipate" }}
                  >
                    <SpotlightCard className="p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
                          <Rocket className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Release Funds</h3>
                          <p className="text-sm text-gray-400">
                            Complete the campaign and release payment
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-6">
                        <Input
                          label="Campaign ID"
                          placeholder="e.g., 1"
                          value={campaignId}
                          onChange={(e) => setCampaignId(e.target.value)}
                        />

                        <div className="pt-4">
                          <ShimmerButton
                            onClick={onRelease}
                            disabled={!canTransact || !campaignId || isPending}
                            className="w-full"
                            background="linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)"
                          >
                            {isPending ? (
                              <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Releasing...
                              </span>
                            ) : (
                              <>
                                Release Funds
                                <Rocket className="w-4 h-4" />
                              </>
                            )}
                          </ShimmerButton>
                        </div>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {lastHash && (
                <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
                  <div className="flex items-start gap-3">
                    {receipt.isLoading ? (
                      <Clock className="w-5 h-5 text-[#F59E0B] animate-pulse shrink-0 mt-0.5" />
                    ) : receipt.isSuccess ? (
                      <CheckCircle className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {receipt.isLoading
                          ? "Transaction Pending"
                          : receipt.isSuccess
                            ? "Transaction Confirmed"
                            : "Transaction Failed"}
                      </p>
                      <a
                        href={getExplorerTxUrl(lastHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[#0052FF] hover:underline flex items-center gap-1 mt-1"
                      >
                        <span className="font-mono truncate">{lastHash.slice(0, 20)}...</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar with sticky positioning */}
            <div className="space-y-6 lg:sticky lg:top-32 lg:h-fit">
              {/* Contract Info */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#0052FF]" />
                  Contract Info
                </h4>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">USDC Contract</p>
                    <p className="font-mono text-xs text-gray-300 truncate">{usdcAddress}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Vault Contract</p>
                    <p className="font-mono text-xs text-gray-300 truncate">
                      {vaultAddress || "Not configured"}
                    </p>
                  </div>
                  {!isConnected && (
                    <p className="text-[#F59E0B] text-xs mt-4">Connect wallet to interact</p>
                  )}
                  {isConnected && !vaultAddress && (
                    <p className="text-[#F59E0B] text-xs mt-4">Set NEXT_PUBLIC_VAULT in .env.local</p>
                  )}
                </div>
              </div>

              {/* Campaign Summary */}
              <AnimatePresence>
                {(objective || budgetUsdc || audience || tone || cta || constraints) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0052FF]/10 to-[#1CD8D2]/10 p-6 backdrop-blur"
                  >
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
                          <p className="text-2xl font-bold gradient-text-hero">{budgetUsdc} USDC</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-16">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                Base Campaign Vault Agent • ETHGlobal HackMoney 2026
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Built on</span>
                <span className="text-[#0052FF] font-semibold">Base</span>
                <span>with</span>
                <span className="gradient-text-hero font-semibold">AI</span>
              </div>
            </div>
          </div>
        </footer>
      </DotBackground>
    </div>
  );
}
