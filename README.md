# Base Campaign Vault Agent

AI campaign builder + USDC escrow onchain. Fokus: Base App creators/brands.

## Workflow (v0)

1) **AI Brief (polite):** generate suggestions → user edits
2) **Lock to Hash:** canonical JSON → `metadataHash`
3) **Escrow flow (Base Sepolia):** Create → Approve USDC → Deposit → Release

When you sign `createCampaign`, the app uses the **locked `metadataHash`** (not a live/auto hash).

## Local dev

```bash
npm install
npm run dev
```

## Environment variables

Create `.env.local` (see `.env.local.example`).

Required for onchain UI:
- `NEXT_PUBLIC_CHAIN_ID=84532`
- `NEXT_PUBLIC_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `NEXT_PUBLIC_VAULT=<deployed CampaignVault address>`

Optional:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...` (recommended for WalletConnect)
- `LLM_API_KEY=...` (AI brief generator)
- `LLM_PROVIDER=openai-compatible`
- `LLM_API_URL=https://api.openai.com/v1/chat/completions`
- `LLM_MODEL=gpt-4o-mini`

Fallback mode: if `LLM_API_KEY` is missing, `POST /api/brief` returns a deterministic template response.

## Contracts

Contracts live in `contracts/` (separate Hardhat workspace). See `contracts/README.md` for deploy + verify.

## Vercel notes

- `.env.local` is not committed; set env vars in Vercel Project Settings.
- Root `tsconfig.json` excludes `contracts/` to avoid Next.js type-checking Hardhat files during `next build`.
