# Contracts

Hardhat workspace for `CampaignVault` on Base Sepolia (chainId `84532`).

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

## Deploy (Base Sepolia)

```bash
npm run deploy
```

After deploy, set the frontend env var `NEXT_PUBLIC_VAULT` to the deployed address.

## Deployment record

- Base Sepolia: `TBD`
- Deploy tx: `TBD`

