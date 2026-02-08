"use client";

import { ConnectButton } from "@/components/connect-button";
import { useMemo, useState, useEffect, useCallback } from "react";
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
  useEnsAddress,
  useEnsAvatar,
  useEnsName,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { baseSepolia, mainnet, sepolia } from "wagmi/chains";
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
import { LiFiBridge } from "@/components/lifi-bridge";
import { CampaignStatusTracker } from "@/components/campaign-status";
import { ContentGenerator } from "@/components/content-generator";
import {
  FileText,
  Sparkles,
  Rocket,
  ShieldCheck,
  ChevronDown,
  Lock,
  User,
  ArrowRightLeft,
} from "lucide-react";

type BriefResponse = {
  brief: string;
  deliverables: string[];
  do: string[];
  dont: string[];
  budgetNotes?: string;
};

type StepMode = "inputs" | "brief";

const CAMPAIGN_STATUS = {
  NONE: 0,
  CREATED: 1,
  DEPOSITED: 2,
  DELIVERED: 3,
  RELEASED: 4,
  REFUNDED: 5,
} as const;

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
  const publicClient = usePublicClient({ chainId: BASE_SEPOLIA_CHAIN_ID });
  const ensPublicClient = usePublicClient({ chainId: mainnet.id });

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

  // ENS Resolution for Publisher (resolve ENS name → address)
  // Check if publisher input looks like an ENS name
  const isEnsName = publisher.includes(".") && !publisher.startsWith("0x");
  const { data: resolvedPublisherAddress, isLoading: isResolvingEns } = useEnsAddress({
    name: isEnsName ? publisher : undefined,
    chainId: sepolia.id, // ENS resolution on Sepolia testnet
  });

  // Get the effective publisher address (resolved or raw input)
  const effectivePublisher = useMemo(() => {
    if (isEnsName && resolvedPublisherAddress) {
      return resolvedPublisherAddress;
    }
    if (publisher && isAddress(publisher)) {
      return publisher as `0x${string}`;
    }
    return null;
  }, [isEnsName, resolvedPublisherAddress, publisher]);

  // ENS Name lookup for advertiser (connected wallet)
  const { data: advertiserEnsName } = useEnsName({
    address: address,
    chainId: mainnet.id, // ENS resolution on mainnet (where ENS names are registered)
  });

  const resolveSenderEnsName = useCallback(async () => {
    const fromHook = typeof advertiserEnsName === "string" ? advertiserEnsName.trim() : "";
    if (fromHook) return fromHook;
    if (!ensPublicClient || !address) return "";
    try {
      return (await ensPublicClient.getEnsName({ address })) ?? "";
    } catch {
      return "";
    }
  }, [advertiserEnsName, ensPublicClient, address]);

  // ENS Avatar for publisher (if resolved)
  const { data: publisherEnsAvatar } = useEnsAvatar({
    name: isEnsName ? publisher : undefined,
    chainId: mainnet.id, // ENS resolution on mainnet
  });

  // ENS Avatar for advertiser
  const { data: advertiserEnsAvatar } = useEnsAvatar({
    name: advertiserEnsName ?? undefined,
    chainId: mainnet.id, // ENS resolution on mainnet
  });

  const objectiveQuality = useMemo(() => analyzeObjective(objective), [objective]);

  const derivedMilestoneCount = useMemo(() => {
    const nonEmptyDeliverables = deliverables.map((item) => item.trim()).filter(Boolean).length;
    return Math.min(20, Math.max(nonEmptyDeliverables || 1, 1));
  }, [deliverables]);

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

  const lockedCanonicalPretty = useMemo(() => {
    if (!lockedCanonicalJson) return null;
    try {
      return JSON.stringify(JSON.parse(lockedCanonicalJson), null, 2);
    } catch {
      return lockedCanonicalJson;
    }
  }, [lockedCanonicalJson]);

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
  const allowance = allowanceQuery.data ?? BigInt(0);
  const refetchAllowance = allowanceQuery.refetch;

  const campaignIdBigInt = useMemo(() => {
    const trimmed = campaignId.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }, [campaignId]);

  // Read campaign status from contract
  const campaignStatusQuery = useReadContract({
    address: vaultAddress,
    abi: campaignVaultAbi,
    functionName: "campaigns",
    args: campaignIdBigInt !== null ? [campaignIdBigInt] : undefined,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(campaignIdBigInt !== null && vaultAddress),
    },
  });
  const refetchCampaignStatus = campaignStatusQuery.refetch;

  const campaignTuple = campaignStatusQuery.data as readonly unknown[] | undefined;

  // Parse campaign status - wagmi returns struct as tuple
  const campaignOnchainStatus = useMemo(() => {
    if (!campaignTuple) return 0; // NONE
    const statusIndex = 4; // status is at index 4 in tuple
    return Number(campaignTuple[statusIndex]);
  }, [campaignTuple]);

  const campaignAdvertiser = useMemo(() => {
    const value = campaignTuple?.[0];
    return typeof value === "string" && isAddress(value) ? (value as `0x${string}`) : null;
  }, [campaignTuple]);

  const campaignPublisher = useMemo(() => {
    const value = campaignTuple?.[1];
    return typeof value === "string" && isAddress(value) ? (value as `0x${string}`) : null;
  }, [campaignTuple]);

  const campaignMilestoneCount = useMemo(() => {
    const value = Number(campaignTuple?.[7] ?? 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, [campaignTuple]);

  const deliveredMilestones = useMemo(() => {
    const value = Number(campaignTuple?.[8] ?? 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [campaignTuple]);

  const releasedMilestones = useMemo(() => {
    const value = Number(campaignTuple?.[9] ?? 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [campaignTuple]);

  const isCampaignAdvertiser = useMemo(() => {
    return Boolean(
      address &&
      campaignAdvertiser &&
      address.toLowerCase() === campaignAdvertiser.toLowerCase(),
    );
  }, [address, campaignAdvertiser]);

  const isCampaignPublisher = useMemo(() => {
    return Boolean(
      address &&
      campaignPublisher &&
      address.toLowerCase() === campaignPublisher.toLowerCase(),
    );
  }, [address, campaignPublisher]);

  const { writeContractAsync, data: lastHash, isPending, error } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: lastHash,
    query: { enabled: Boolean(lastHash) },
  });

  const createdCampaignId = useMemo(() => {
    if (!receipt.data) return null;
    for (const log of receipt.data.logs) {
      if (vaultAddress && log.address.toLowerCase() !== vaultAddress.toLowerCase()) {
        continue;
      }
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
  }, [receipt.data, vaultAddress]);

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
    // Scroll back to Campaign Details section after state updates
    setTimeout(() => {
      document.getElementById("campaign-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
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

  const onCreateCampaign = useCallback(async () => {
    if (!vaultAddress) return;
    if (!lockedMetadataHash) throw new Error("Lock your AI brief to a hash first.");
    if (isDirtySinceLock) throw new Error("Brief changed since lock. Lock again.");
    if (!budgetUnits) throw new Error("Invalid budget");

    const ensName = await resolveSenderEnsName();
    const days = Number(deadlineDays);
    if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid deadline days");
    const deadline =
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(Math.floor(days * 86400));

    if (derivedMilestoneCount > 1) {
      await writeContractAsync({
        address: vaultAddress,
        abi: campaignVaultAbi,
        functionName: ensName
          ? "createCampaignWithMilestonesAndEns"
          : "createCampaignWithMilestones",
        args: ensName
          ? [
            effectivePublisher ?? zeroAddress,
            budgetUnits,
            deadline,
            lockedMetadataHash,
            derivedMilestoneCount,
            ensName,
          ]
          : [
            effectivePublisher ?? zeroAddress,
            budgetUnits,
            deadline,
            lockedMetadataHash,
            derivedMilestoneCount,
          ],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });
      return;
    }

    await writeContractAsync({
      address: vaultAddress,
      abi: campaignVaultAbi,
      functionName: ensName ? "createCampaignWithEns" : "createCampaign",
      args: ensName
        ? [effectivePublisher ?? zeroAddress, budgetUnits, deadline, lockedMetadataHash, ensName]
        : [effectivePublisher ?? zeroAddress, budgetUnits, deadline, lockedMetadataHash],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });
  }, [
    vaultAddress,
    lockedMetadataHash,
    isDirtySinceLock,
    budgetUnits,
    deadlineDays,
    derivedMilestoneCount,
    writeContractAsync,
    effectivePublisher,
    resolveSenderEnsName,
  ]);

  // Combined function: approve (if needed) + deposit
  const onFundCampaign = useCallback(async () => {
    if (!vaultAddress) return;
    if (campaignIdBigInt === null) throw new Error("Campaign ID must be a positive integer");
    if (!budgetUnits) throw new Error("Invalid budget");
    if (!publicClient) throw new Error("RPC client not ready");

    const ensName = await resolveSenderEnsName();
    // Check if we need to approve first
    if (allowance < budgetUnits) {
      // First approve
      const approveHash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress, budgetUnits],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      await refetchAllowance();
    }

    // Then deposit
    const depositHash = await writeContractAsync(
      ensName
        ? {
          address: vaultAddress,
          abi: campaignVaultAbi,
          functionName: "depositWithEns",
          args: [campaignIdBigInt, ensName],
          chainId: BASE_SEPOLIA_CHAIN_ID,
        }
        : {
          address: vaultAddress,
          abi: campaignVaultAbi,
          functionName: "deposit",
          args: [campaignIdBigInt],
          chainId: BASE_SEPOLIA_CHAIN_ID,
        },
    );
    await publicClient.waitForTransactionReceipt({ hash: depositHash });

    // Refetch campaign status
    await refetchCampaignStatus();
  }, [
    vaultAddress,
    campaignIdBigInt,
    budgetUnits,
    publicClient,
    allowance,
    refetchAllowance,
    writeContractAsync,
    usdcAddress,
    refetchCampaignStatus,
    resolveSenderEnsName,
  ]);

  const onMarkDelivered = useCallback(async () => {
    if (!vaultAddress) return;
    if (campaignIdBigInt === null) throw new Error("Campaign ID must be a positive integer");
    if (!publicClient) throw new Error("RPC client not ready");
    // Generate a proof hash from timestamp + campaign id
    const proofHash = keccak256(toHex(`proof-${campaignIdBigInt.toString()}-${Date.now()}`));
    const nextMilestoneIndex = deliveredMilestones + 1;
    const ensName = await resolveSenderEnsName();
    const markDeliveredHash = await writeContractAsync(
      campaignMilestoneCount > 1
        ? ensName
          ? {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "markMilestoneDeliveredWithEns",
            args: [campaignIdBigInt, proofHash, nextMilestoneIndex, ensName],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          }
          : {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "markMilestoneDelivered",
            args: [campaignIdBigInt, proofHash, nextMilestoneIndex],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          }
        : ensName
          ? {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "markDeliveredWithEns",
            args: [campaignIdBigInt, proofHash, ensName],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          }
          : {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "markDelivered",
            args: [campaignIdBigInt, proofHash],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          },
    );
    await publicClient.waitForTransactionReceipt({ hash: markDeliveredHash });
    // Refetch campaign status
    await refetchCampaignStatus();
  }, [
    vaultAddress,
    campaignIdBigInt,
    publicClient,
    writeContractAsync,
    refetchCampaignStatus,
    campaignMilestoneCount,
    deliveredMilestones,
    resolveSenderEnsName,
  ]);

  const onRelease = useCallback(async () => {
    if (!vaultAddress) return;
    if (campaignIdBigInt === null) throw new Error("Campaign ID must be a positive integer");
    if (!publicClient) throw new Error("RPC client not ready");
    const hasUnreleasedMilestones =
      campaignMilestoneCount > 1 && releasedMilestones < campaignMilestoneCount;
    const ensName = await resolveSenderEnsName();
    const releaseHash = await writeContractAsync(
      hasUnreleasedMilestones
        ? ensName
          ? {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "releaseMilestoneWithEns",
            args: [campaignIdBigInt, ensName],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          }
          : {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "releaseMilestone",
            args: [campaignIdBigInt],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          }
        : ensName
          ? {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "releaseWithEns",
            args: [campaignIdBigInt, ensName],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          }
          : {
            address: vaultAddress,
            abi: campaignVaultAbi,
            functionName: "release",
            args: [campaignIdBigInt],
            chainId: BASE_SEPOLIA_CHAIN_ID,
          },
    );
    await publicClient.waitForTransactionReceipt({ hash: releaseHash });
    // Refetch campaign status
    await refetchCampaignStatus();
  }, [
    vaultAddress,
    campaignIdBigInt,
    publicClient,
    writeContractAsync,
    refetchCampaignStatus,
    campaignMilestoneCount,
    releasedMilestones,
    resolveSenderEnsName,
  ]);

  // Smart button logic - determine what action to show
  const smartButtonConfig = useMemo(() => {
    // No campaign yet
    if (!campaignId) {
      return {
        label: "Create Campaign",
        onClick: onCreateCampaign,
        disabled:
          !canTransact ||
          !budgetUnits ||
          !effectivePublisher ||
          !lockedMetadataHash ||
          isDirtySinceLock,
      };
    }

    const nextMilestoneToDeliver = Math.min(campaignMilestoneCount, deliveredMilestones + 1);
    const nextMilestoneToRelease = Math.min(campaignMilestoneCount, releasedMilestones + 1);

    // Campaign exists - check status
    switch (campaignOnchainStatus) {
      case CAMPAIGN_STATUS.CREATED:
        return {
          label: "Fund Campaign",
          onClick: onFundCampaign,
          disabled:
            !canTransact ||
            !isCampaignAdvertiser ||
            !lockedMetadataHash ||
            isDirtySinceLock,
        };
      case CAMPAIGN_STATUS.DEPOSITED:
        if (campaignMilestoneCount > 1) {
          if (deliveredMilestones > releasedMilestones) {
            return {
              label: `Release Milestone ${nextMilestoneToRelease}/${campaignMilestoneCount}`,
              onClick: onRelease,
              disabled: !canTransact || !isCampaignAdvertiser,
            };
          }
          return {
            label: `Mark Milestone ${nextMilestoneToDeliver}/${campaignMilestoneCount} Delivered`,
            onClick: onMarkDelivered,
            disabled: !canTransact || !isCampaignPublisher,
          };
        }
        return {
          label: "Mark Delivered",
          onClick: onMarkDelivered,
          disabled: !canTransact || !isCampaignPublisher,
        };
      case CAMPAIGN_STATUS.DELIVERED:
        if (campaignMilestoneCount > 1 && releasedMilestones < campaignMilestoneCount) {
          return {
            label: `Release Milestone ${nextMilestoneToRelease}/${campaignMilestoneCount}`,
            onClick: onRelease,
            disabled: !canTransact || !isCampaignAdvertiser,
          };
        }
        return {
          label: "Release Payment",
          onClick: onRelease,
          disabled: !canTransact || !isCampaignAdvertiser,
        };
      case CAMPAIGN_STATUS.RELEASED:
        return {
          label: "✅ Complete",
          onClick: () => { },
          disabled: true,
        };
      case CAMPAIGN_STATUS.REFUNDED:
        return {
          label: "🔄 Refunded",
          onClick: () => { },
          disabled: true,
        };
      default:
        return {
          label: "Create Campaign",
          onClick: onCreateCampaign,
          disabled:
            !canTransact ||
            !budgetUnits ||
            !effectivePublisher ||
            !lockedMetadataHash ||
            isDirtySinceLock,
        };
    }
  }, [
    campaignId,
    campaignOnchainStatus,
    campaignMilestoneCount,
    deliveredMilestones,
    releasedMilestones,
    canTransact,
    budgetUnits,
    effectivePublisher,
    isCampaignAdvertiser,
    isCampaignPublisher,
    lockedMetadataHash,
    isDirtySinceLock,
    onCreateCampaign,
    onFundCampaign,
    onMarkDelivered,
    onRelease,
  ]);

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
              <div id="campaign-details">
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
              </div>

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

                {/* Edit/Lock Actions - moved here below Do/Don't */}
                <div className="flex flex-wrap gap-2 mt-4">
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
                          {lockedCanonicalPretty}
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
                        {/* Advertiser ENS Display */}
                        {isConnected && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                            {advertiserEnsAvatar ? (
                              <Image
                                src={advertiserEnsAvatar}
                                alt="Your ENS Avatar"
                                width={32}
                                height={32}
                                unoptimized
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0052FF] to-[#1CD8D2] flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-gray-500">Advertiser</p>
                              <p className="font-medium text-emerald-400">
                                {advertiserEnsName ?? `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                              </p>
                            </div>
                          </div>
                        )}
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

              {/* AI Content Generator - Only show when brief is locked */}
              {lockedMetadataHash && (
                <ContentGenerator
                  brief={aiBrief}
                  deliverables={deliverables}
                  objective={objective}
                  audience={audience}
                  tone={tone}
                  cta={cta}
                  isLocked={!!lockedMetadataHash}
                />
              )}
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
                  <div>
                    <Input
                      label="Publisher address"
                      placeholder="vitalik.eth or 0x..."
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      className="font-mono text-xs"
                    />
                    {/* ENS Resolution Status */}
                    {publisher && (
                      <div className="mt-2 text-xs">
                        {isResolvingEns && (
                          <div className="flex items-center gap-2 text-amber-400">
                            <span className="animate-pulse">●</span>
                            Resolving ENS...
                          </div>
                        )}
                        {isEnsName && resolvedPublisherAddress && (
                          <div className="flex items-center gap-2 text-emerald-400">
                            {publisherEnsAvatar && (
                              <Image
                                src={publisherEnsAvatar}
                                alt="ENS Avatar"
                                width={20}
                                height={20}
                                unoptimized
                                className="w-5 h-5 rounded-full"
                              />
                            )}
                            <span>✓ {publisher}</span>
                            <span className="text-gray-500 font-mono">
                              ({resolvedPublisherAddress.slice(0, 6)}...{resolvedPublisherAddress.slice(-4)})
                            </span>
                          </div>
                        )}
                        {isEnsName && !isResolvingEns && !resolvedPublisherAddress && (
                          <div className="text-red-400">
                            ✗ ENS name not found
                          </div>
                        )}
                        {!isEnsName && isAddress(publisher) && (
                          <div className="text-emerald-400">
                            ✓ Valid address
                          </div>
                        )}
                        {!isEnsName && publisher && !isAddress(publisher) && (
                          <div className="text-red-400">
                            ✗ Invalid address
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                  <p className="mt-1 text-xs text-gray-500">
                    Milestones (derived): {derivedMilestoneCount}
                    {campaignId && campaignMilestoneCount > 0
                      ? ` • Onchain ${campaignMilestoneCount} • Delivered ${deliveredMilestones} • Released ${releasedMilestones}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Progress Stepper */}
                {campaignId && (
                  <div className="flex items-center justify-between text-xs text-gray-400 px-2">
                    {[
                      { status: CAMPAIGN_STATUS.CREATED, label: "Created" },
                      { status: CAMPAIGN_STATUS.DEPOSITED, label: "Funded" },
                      { status: CAMPAIGN_STATUS.DELIVERED, label: "Delivered" },
                      { status: CAMPAIGN_STATUS.RELEASED, label: "Released" },
                    ].map((step, idx, arr) => (
                      <div key={step.status} className="flex items-center">
                        <div className={`flex items-center gap-1.5 ${campaignOnchainStatus >= step.status
                          ? "text-emerald-400"
                          : campaignOnchainStatus === step.status - 1
                            ? "text-blue-400"
                            : "text-gray-600"
                          }`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${campaignOnchainStatus >= step.status
                            ? "bg-emerald-500/20 border border-emerald-500"
                            : campaignOnchainStatus === step.status - 1
                              ? "bg-blue-500/20 border border-blue-500 animate-pulse"
                              : "bg-gray-800 border border-gray-700"
                            }`}>
                            {campaignOnchainStatus >= step.status ? "✓" : idx + 1}
                          </div>
                          <span className="hidden sm:inline">{step.label}</span>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={`w-6 sm:w-10 h-0.5 mx-1 ${campaignOnchainStatus > step.status
                            ? "bg-emerald-500"
                            : "bg-gray-700"
                            }`} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Fund Step: Two Buttons + Bridge Disclaimer */}
                {campaignId && campaignOnchainStatus === CAMPAIGN_STATUS.CREATED && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <ActionButton
                        label="Fund Campaign"
                        disabled={!canTransact || !lockedMetadataHash || isDirtySinceLock}
                        busy={isPending}
                        onClick={smartButtonConfig.onClick}
                      />
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          document.getElementById("bridge-section")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Bridge to Base
                      </Button>
                    </div>
                    <p className="text-xs text-center text-gray-500">
                      💡 Bridge available on mainnet only. For testnet, use{" "}
                      <a
                        href="https://faucet.circle.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline hover:text-blue-300"
                      >
                        Circle Faucet
                      </a>
                    </p>
                  </div>
                )}

                {/* Other Steps: Single Magic Button */}
                {(!campaignId || campaignOnchainStatus !== CAMPAIGN_STATUS.CREATED) && (
                  <ActionButton
                    label={smartButtonConfig.label}
                    disabled={smartButtonConfig.disabled}
                    busy={isPending}
                    onClick={smartButtonConfig.onClick}
                  />
                )}

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

        {/* LI.FI Bridge Section */}
        <section id="bridge-section" className="mx-auto max-w-6xl px-6 pb-8">
          <LiFiBridge />
        </section>

        {/* Campaign Status Tracker Section */}
        <section className="mx-auto max-w-6xl px-6 pb-8">
          <CampaignStatusTracker />
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
    </div >
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
