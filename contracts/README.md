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

## Verify (Base Sepolia)

1) Set `BASESCAN_API_KEY` in `.env` (from BaseScan)
2) Set `VAULT_ADDRESS` to the deployed contract address
3) Run:

```bash
npm run verify:vault
```

## Deployment record

- Base Sepolia: `0x316c82205681B098d6a6b6Ac1fa221074F62E2E3`
- Deploy tx: `0x531a4e70a4475d3d48bedba8c0dfbcf535fa3ae6c82315c8034b0dac40bed61a`
