# Base Campaign Vault Agent

AI campaign builder + USDC escrow onchain. Built for Base App creators/brands.

## Contract Status

This branch includes milestone escrow (`createCampaignWithMilestones`, `markMilestoneDelivered`, `releaseMilestone`).
Deploy a fresh `CampaignVault` from `contracts/` and set `NEXT_PUBLIC_VAULT` to that address.

## Workflow

1. **Create** – Advertiser defines campaign (objective, audience, tone, CTA, constraints, budget)
2. **Generate** – AI creates brief + deliverables
3. **Milestones** – Deliverables derive milestone count (1..20)
4. **Fund** – Deposit USDC into escrow (requires publisher assigned)
5. **Deliver / Release** – Publisher marks milestones delivered, advertiser releases milestone payouts

## Smart Contract Features

- **Deferred Publisher Assignment** – Create campaigns without specifying publisher upfront
- **`assignPublisher(campaignId, publisher)`** – Assign publisher after creation
- **Milestone Escrow** – `createCampaignWithMilestones` + staged settlement
- **Sequential Delivery Rules** – Milestones must be delivered/released in order
- **Partial Refunds** – Refunds return only remaining escrow after partial releases
- **USDC Escrow + Platform Fee** – Configurable fee with exact cumulative accounting

## Quickstart

```bash
# Frontend
npm install
npm run dev
```

Open http://localhost:3000

### Deploy Contract

```bash
cd contracts
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY and TREASURY
npm install
npm run build
npm run deploy
```

Then update frontend env:

```bash
# .env.local
NEXT_PUBLIC_VAULT=<newly-deployed-vault-address>
```

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- RainbowKit + Wagmi + Viem
- Hardhat + Solidity (^0.8.24, compiled with 0.8.26)
- Base Sepolia (Chain ID: 84532)

## Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_VAULT=<milestone-enabled vault from this branch>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<optional>

# Optional: AI brief generation (fallback template is used when unset)
LLM_API_KEY=
LLM_PROVIDER=openai-compatible
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=20000

# Contracts (.env)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=<your-private-key>
TREASURY=<treasury-address>
FEE_BPS=200
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASESCAN_API_KEY=<optional>
VAULT_ADDRESS=<set for verify:vault>
```
