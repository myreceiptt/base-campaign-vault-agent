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

type BriefResponse = {
  brief: string;
  deliverables: string[];
  do: string[];
  dont: string[];
  budgetNotes?: string;
};

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [cta, setCta] = useState("");
  const [constraints, setConstraints] = useState("");

  const [aiBrief, setAiBrief] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);
  const [budgetNotes, setBudgetNotes] = useState("");
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [lockedMetadataHash, setLockedMetadataHash] = useState<`0x${string}` | null>(
    null,
  );
  const [lockedCanonicalJson, setLockedCanonicalJson] = useState<string | null>(null);

  const [budgetUsdc, setBudgetUsdc] = useState("");
  const [publisher, setPublisher] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [campaignId, setCampaignId] = useState<string>("");

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
    if (!objective.trim()) {
      setBriefError("Objective is required.");
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
    } catch (err) {
      setBriefError((err as Error).message);
    } finally {
      setIsGeneratingBrief(false);
    }
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

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Base Campaign Vault Agent
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              AI campaign builder + USDC escrow onchain. Fokus: Base App
              creators/brands.
            </p>
          </div>
          <div className="pt-1">
            <ConnectButton />
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Campaign objective</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., Drive 1,000 signups for Base App"
        name="objective"
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
      />
    </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Audience</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., Base App creators shipping weekly"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Budget (USDC)</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., 500"
                name="budget"
                inputMode="decimal"
                value={budgetUsdc}
                onChange={(e) => setBudgetUsdc(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Tone</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., confident, concise, onchain-native"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Primary CTA</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., Mint, Sign up, Try the demo"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Constraints</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., no paid influencers; 2-week timeline; no AI claims"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
              />
            </label>
          </div>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Polite AI workflow: generate suggestions → edit → lock to hash → sign
            the onchain tx.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">AI Brief + Deliverables</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                The AI suggests. You can edit everything before locking it into
                `metadataHash`.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white"
                disabled={isGeneratingBrief || !objective.trim()}
                onClick={() => void onGenerateBrief()}
              >
                {isGeneratingBrief ? "Generating…" : "Generate Brief"}
              </button>
              <button
                type="button"
                className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                disabled={!currentMetadataHash}
                onClick={onLockToHash}
              >
                Lock to Hash
              </button>
            </div>
          </div>

          {briefError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              {briefError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Brief</span>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="Generate a brief, then edit it here."
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
              />
            </label>

            {budgetNotes ? (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Budget notes (optional)</span>
                <textarea
                  className="min-h-[80px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                />
              </label>
            ) : null}

            <EditableList
              title="Deliverables checklist"
              items={deliverables}
              setItems={setDeliverables}
              placeholder="Add a deliverable…"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableList
                title="Do"
                items={dos}
                setItems={setDos}
                placeholder="Add a do…"
              />
              <EditableList
                title="Don't"
                items={donts}
                setItems={setDonts}
                placeholder="Add a don't…"
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium">metadataHash (locked)</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                {lockedMetadataHash
                  ? isDirtySinceLock
                    ? "Edited since lock — lock again before signing."
                    : "Ready to sign."
                  : "Not locked yet."}
              </div>
            </div>
            <div className="mt-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
              {lockedMetadataHash ?? "—"}
            </div>
            {lockedCanonicalJson ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
                  View canonical JSON (locked)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                  {lockedCanonicalJson}
                </pre>
              </details>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Onchain (Base Sepolia)</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                USDC: <span className="font-mono text-xs">{usdcAddress}</span>
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Vault:{" "}
                <span className="font-mono text-xs">
                  {vaultAddress ?? "set NEXT_PUBLIC_VAULT"}
                </span>
              </p>
            </div>
            {wrongChain ? (
              <button
                type="button"
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white"
                disabled={isSwitching}
                onClick={() => switchChain({ chainId: baseSepolia.id })}
              >
                Switch to Base Sepolia
              </button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Publisher address</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-mono outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="0x..."
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Deadline (days)</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                inputMode="numeric"
                placeholder="7"
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Campaign ID</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder={createdCampaignId ?? "e.g., 1"}
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              />
            </label>
            <div className="flex flex-col justify-end gap-2">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Allowance:{" "}
                <span className="font-mono text-xs">
                  {allowanceQuery.data?.toString() ?? "—"}
                </span>
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                metadataHash:{" "}
                <span className="font-mono text-xs">
                  {lockedMetadataHash ?? "lock in Step 1"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {!isConnected ? "Connect a wallet to transact." : null}
            {isConnected && wrongChain
              ? " Switch to Base Sepolia (84532) to transact."
              : null}
            {isConnected && !vaultAddress
              ? " Set NEXT_PUBLIC_VAULT in .env.local."
              : null}
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              {error.message}
            </div>
          ) : null}

          {lastHash ? (
            <div className="mt-3 flex flex-col gap-1 text-sm">
              <div className="text-zinc-600 dark:text-zinc-400">
                Tx:{" "}
                <a
                  className="font-mono text-xs underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500 dark:decoration-zinc-700"
                  href={getExplorerTxUrl(lastHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {lastHash}
                </a>
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                Status:{" "}
                {receipt.isLoading
                  ? "pending"
                  : receipt.isSuccess
                    ? "confirmed"
                    : receipt.isError
                      ? "error"
                      : "—"}
                {createdCampaignId ? ` • created campaignId: ${createdCampaignId}` : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <FlowCard
            step="01"
            title="Create Campaign"
            description="Define objective, audience, and success metrics."
            cta="Create"
          />
          <FlowCard
            step="02"
            title="Deposit"
            description="Lock the campaign budget into an escrow vault."
            cta="Deposit"
          />
          <FlowCard
            step="03"
            title="Generate Content"
            description="Draft campaign assets and copy for review."
            cta="Generate"
          />
          <FlowCard
            step="04"
            title="Release"
            description="Publish and release funds based on milestones."
            cta="Release"
          />
        </section>

        <footer className="pt-6 text-sm text-zinc-500 dark:text-zinc-500">
          v0 scaffold — next: wallet connect, escrow contract, AI route.
        </footer>
      </main>
    </div>
  );
}

function FlowCard(props: {
  step: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
            {props.step}
          </div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {props.description}
          </p>
        </div>
        <button
          type="button"
          className="h-10 shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white dark:focus:ring-zinc-50/20"
        >
          {props.cta}
        </button>
      </div>
    </div>
  );
}

function ActionButton(props: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled || props.busy}
      onClick={() => void props.onClick()}
      className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white"
    >
      {props.busy ? "Working…" : props.label}
    </button>
  );
}

function EditableList(props: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{props.title}</div>
        <button
          type="button"
          className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          onClick={() => props.setItems([...props.items, ""])}
        >
          Add
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {props.items.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-500">
            {props.placeholder}
          </div>
        ) : null}
        {props.items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
              placeholder={props.placeholder}
              value={item}
              onChange={(e) => {
                const next = props.items.slice();
                next[idx] = e.target.value;
                props.setItems(next);
              }}
            />
            <button
              type="button"
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => {
                const next = props.items.filter((_, i) => i !== idx);
                props.setItems(next);
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
