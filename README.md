# Base Campaign Vault Agent

AI campaign builder + USDC escrow onchain. Built for Base App creators/brands.

## Live Contract

| Network | Address |
|---------|---------|
| Base Sepolia | `0x86E8673b3f2c89028bD32262Bc25dAA0e3c2eC92` |

## Workflow

1. **Create** – Advertiser defines campaign (objective, audience, tone, CTA, constraints, budget)
2. **Generate** – AI creates content (coming soon)  
3. **Fund** – Deposit USDC into escrow (requires publisher assigned)
4. **Release** – Approve & payout to publisher

## Smart Contract Features

- **Deferred Publisher Assignment** – Create campaigns without specifying publisher upfront
- **`assignPublisher(campaignId, publisher)`** – Assign publisher after creation
- **USDC Escrow** – Funds held until milestones completed
- **2% Platform Fee** – Configurable fee on release

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

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- RainbowKit + Wagmi + Viem
- Hardhat + Solidity 0.8.24
- Base Sepolia (Chain ID: 84532)

## Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_VAULT=0x86E8673b3f2c89028bD32262Bc25dAA0e3c2eC92
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<optional>

# Contracts (.env)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=<your-private-key>
TREASURY=<treasury-address>
FEE_BPS=200
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```
