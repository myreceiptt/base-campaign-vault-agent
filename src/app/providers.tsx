"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia, mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Include mainnet for ENS resolution (ENS names & avatars are on mainnet)
const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({
    appName: "Base Campaign Vault Agent",
    projectId: walletConnectProjectId,
    chains: [baseSepolia, mainnet, sepolia],
    transports: {
      [baseSepolia.id]: http(),
      [mainnet.id]: http(), // Required for ENS name & avatar resolution
      [sepolia.id]: http(),
    },
    ssr: true,
  })
  : createConfig({
    chains: [baseSepolia, mainnet, sepolia],
    connectors: [injected()],
    transports: {
      [baseSepolia.id]: http(),
      [mainnet.id]: http(), // Required for ENS name & avatar resolution
      [sepolia.id]: http(),
    },
    ssr: true,
  });

export function Providers(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{props.children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
