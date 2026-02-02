import { run } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const DEFAULT_USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const vaultAddress = process.env.VAULT_ADDRESS;
  const usdc = process.env.USDC ?? DEFAULT_USDC_BASE_SEPOLIA;
  const treasury = process.env.TREASURY;
  const feeBps = Number(process.env.FEE_BPS ?? "200");

  if (!vaultAddress) throw new Error("Missing VAULT_ADDRESS env var");
  if (!treasury) throw new Error("Missing TREASURY env var");
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error("Invalid FEE_BPS (0..10000)");
  }

  await run("verify:verify", {
    address: vaultAddress,
    constructorArguments: [usdc, treasury, feeBps],
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

