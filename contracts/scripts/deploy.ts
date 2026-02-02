import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const DEFAULT_USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const usdc = process.env.USDC ?? DEFAULT_USDC_BASE_SEPOLIA;
  const treasury = process.env.TREASURY;
  const feeBps = Number(process.env.FEE_BPS ?? "200");

  if (!treasury) {
    throw new Error("Missing TREASURY env var");
  }
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error("Invalid FEE_BPS (0..10000)");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("USDC:", usdc);
  console.log("Treasury:", treasury);
  console.log("Fee (bps):", feeBps);

  const CampaignVault = await ethers.getContractFactory("CampaignVault");
  const vault = await CampaignVault.deploy(usdc, treasury, feeBps);

  const deployTx = vault.deploymentTransaction();
  console.log("Deploy tx:", deployTx?.hash);
  await vault.waitForDeployment();

  console.log("CampaignVault:", await vault.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

