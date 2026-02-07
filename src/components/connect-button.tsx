"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsAvatar, useEnsName } from "wagmi";
import { sepolia } from "wagmi/chains";

/**
 * Custom ConnectButton that displays ENS names from Sepolia testnet.
 * RainbowKit's default ConnectButton doesn't resolve Sepolia ENS,
 * so we wrap it and override the display name/avatar.
 */
export function ConnectButton() {
    return (
        <RainbowConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
            }) => {
                const ready = mounted && authenticationStatus !== "loading";
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus || authenticationStatus === "authenticated");

                // Resolve ENS on Sepolia testnet
                const { data: ensName } = useEnsName({
                    address: account?.address as `0x${string}` | undefined,
                    chainId: sepolia.id,
                });

                const { data: ensAvatar } = useEnsAvatar({
                    name: ensName ?? undefined,
                    chainId: sepolia.id,
                });

                // Use ENS name if available, otherwise use shortened address
                const displayName = ensName ?? account?.displayName;
                const displayAvatar = ensAvatar ?? account?.ensAvatar;

                return (
                    <div
                        {...(!ready && {
                            "aria-hidden": true,
                            style: {
                                opacity: 0,
                                pointerEvents: "none",
                                userSelect: "none",
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        type="button"
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#1CD8D2] text-white font-medium hover:opacity-90 transition"
                                    >
                                        Connect Wallet
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="px-4 py-2 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition"
                                    >
                                        Wrong network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                                    >
                                        {chain.hasIcon && (
                                            <div
                                                className="w-5 h-5 rounded-full overflow-hidden"
                                                style={{ background: chain.iconBackground }}
                                            >
                                                {chain.iconUrl && (
                                                    <img
                                                        alt={chain.name ?? "Chain icon"}
                                                        src={chain.iconUrl}
                                                        className="w-5 h-5"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <span className="text-sm text-gray-300">{chain.name}</span>
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        type="button"
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                                    >
                                        {displayAvatar && (
                                            <img
                                                src={displayAvatar}
                                                alt="ENS Avatar"
                                                className="w-6 h-6 rounded-full"
                                            />
                                        )}
                                        <span className="text-sm font-medium text-white">
                                            {displayName}
                                        </span>
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </RainbowConnectButton.Custom>
    );
}
