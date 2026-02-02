import { baseSepolia } from "wagmi/chains";

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export function getExplorerTxUrl(txHash: string) {
  return `${baseSepolia.blockExplorers.default.url}/tx/${txHash}`;
}
