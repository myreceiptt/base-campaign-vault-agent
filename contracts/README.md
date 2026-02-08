# Contracts

Hardhat workspace for `CampaignVault` on Base Sepolia (chainId `84532`).

## Milestone Escrow Features

- `createCampaignWithMilestones(..., milestoneCount)`
- `markMilestoneDelivered(campaignId, proofHash, milestoneIndex)`
- `releaseMilestone(campaignId)` for staged payout
- `getMilestoneState(campaignId)` for milestone/release counters

## Setup

```bash
cd contracts
npm install
cp .env.example .env
```

Fill in:
- `DEPLOYER_PRIVATE_KEY`
- `TREASURY`
- (optional) `BASE_SEPOLIA_RPC_URL`

## Compile + test

```bash
npm run build
npm test
```

Compiler target in this workspace is Solidity `0.8.26` (contract pragma remains `^0.8.24`).

## Deploy (Base Sepolia)

```bash
npm run deploy
```

After deploy, set the frontend env var `NEXT_PUBLIC_VAULT` to the deployed address.

## Verify (Base Sepolia)

1) Set `BASESCAN_API_KEY` in `.env` (from BaseScan)
2) Set `VAULT_ADDRESS` to the deployed contract address
3) Run:

```bash
npm run verify:vault
```
