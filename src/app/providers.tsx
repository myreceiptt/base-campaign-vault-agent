"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({
      appName: "Base Campaign Vault Agent",
      projectId: walletConnectProjectId,
      chains: [baseSepolia],
      transports: {
        [baseSepolia.id]: http(),
      },
      ssr: true,
    })
  : createConfig({
      chains: [baseSepolia],
      connectors: [injected()],
      transports: {
        [baseSepolia.id]: http(),
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
