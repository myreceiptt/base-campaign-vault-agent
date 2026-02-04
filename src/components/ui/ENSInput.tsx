"use client";

import { forwardRef, useState, useEffect, useCallback } from "react";
import { useEnsAddress, useEnsName, useEnsAvatar } from "wagmi";
import { isAddress } from "viem";
import { normalize } from "viem/ens";
import { AlertCircle, Check, Loader2, Search, User } from "lucide-react";
import { mainnet } from "wagmi/chains";

export interface ENSInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
    label?: string;
    error?: string;
    hint?: string;
    value: string;
    onChange: (value: string, resolvedAddress?: string) => void;
    onResolvedAddress?: (address: string | null) => void;
}

/**
 * ENS-enabled address input component
 * 
 * This component provides ENS name resolution functionality:
 * - Type an ENS name (e.g., "vitalik.eth") and it resolves to an address
 * - Type an address and it shows the reverse-resolved ENS name
 * - Shows ENS avatar when available
 * - Validates addresses and ENS names
 * 
 * Required for ENS Hackathon Prize ($5,000)
 */
export const ENSInput = forwardRef<HTMLInputElement, ENSInputProps>(
    (
        {
            label,
            error: externalError,
            hint,
            value,
            onChange,
            onResolvedAddress,
            className = "",
            ...props
        },
        ref
    ) => {
        const [inputValue, setInputValue] = useState(value);
        const [debouncedValue, setDebouncedValue] = useState(value);
        const [isFocused, setIsFocused] = useState(false);

        // Determine if input is an ENS name or address
        const isENSName = debouncedValue.endsWith(".eth") || debouncedValue.includes(".");
        const isValidAddress = isAddress(debouncedValue);

        // Normalize ENS name for lookup
        const normalizedEns = (() => {
            try {
                return isENSName ? normalize(debouncedValue) : undefined;
            } catch {
                return undefined;
            }
        })();

        // Resolve ENS name to address
        const {
            data: resolvedAddress,
            isLoading: isResolvingAddress,
            isError: addressResolutionFailed,
        } = useEnsAddress({
            name: normalizedEns,
            chainId: mainnet.id,
            query: {
                enabled: Boolean(normalizedEns) && isENSName,
            },
        });

        // Reverse resolve address to ENS name
        const {
            data: resolvedEnsName,
            isLoading: isResolvingName,
        } = useEnsName({
            address: isValidAddress ? (debouncedValue as `0x${string}`) : undefined,
            chainId: mainnet.id,
            query: {
                enabled: isValidAddress && !isENSName,
            },
        });

        // Get ENS avatar
        const { data: ensAvatar } = useEnsAvatar({
            name: resolvedEnsName || normalizedEns,
            chainId: mainnet.id,
            query: {
                enabled: Boolean(resolvedEnsName || normalizedEns),
            },
        });

        // Debounce input changes
        useEffect(() => {
            const timer = setTimeout(() => {
                setDebouncedValue(inputValue);
            }, 500);
            return () => clearTimeout(timer);
        }, [inputValue]);

        // Notify parent of resolved address
        useEffect(() => {
            if (resolvedAddress) {
                onResolvedAddress?.(resolvedAddress);
                onChange(inputValue, resolvedAddress);
            } else if (isValidAddress) {
                onResolvedAddress?.(debouncedValue);
                onChange(inputValue, debouncedValue);
            } else {
                onResolvedAddress?.(null);
            }
        }, [resolvedAddress, isValidAddress, debouncedValue, inputValue, onChange, onResolvedAddress]);

        const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setInputValue(newValue);
            onChange(newValue);
        }, [onChange]);

        // Determine status
        const isLoading = isResolvingAddress || isResolvingName;
        const isSuccess = Boolean(resolvedAddress) || isValidAddress;
        const hasError = externalError || (addressResolutionFailed && isENSName);
        const errorMessage = externalError || (addressResolutionFailed ? "Could not resolve ENS name" : undefined);

        const getInputStyles = () => {
            if (hasError) {
                return "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error-light)]";
            }
            if (isSuccess && !isLoading) {
                return "border-[var(--success)] focus:border-[var(--success)] focus:ring-[var(--success-light)]";
            }
            return "border-[var(--input)] focus:border-[var(--base-blue)] focus:ring-[var(--base-blue-50)]";
        };

        return (
            <div className="flex flex-col gap-2">
                {label && (
                    <label
                        className={`text-sm font-medium transition-colors ${isFocused
                            ? hasError
                                ? "text-[var(--error)]"
                                : isSuccess
                                    ? "text-[var(--success)]"
                                    : "text-[var(--base-blue)]"
                            : "text-[var(--foreground)]"
                            }`}
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {/* Left icon / Avatar */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        {ensAvatar ? (
                            <img
                                src={ensAvatar}
                                alt="ENS Avatar"
                                className="w-6 h-6 rounded-full object-cover"
                            />
                        ) : (
                            <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
                        )}
                    </div>

                    <input
                        ref={ref}
                        value={inputValue}
                        onChange={handleChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        className={`
              h-11 w-full rounded-xl
              bg-[var(--card)]
              pl-11 pr-10 text-sm font-mono
              border
              outline-none
              transition-all duration-200
              placeholder:text-[var(--muted-foreground)]
              focus:ring-[3px]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${getInputStyles()}
              ${className}
            `}
                        {...props}
                    />

                    {/* Right icon - Status */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 text-[var(--base-blue)] animate-spin" />
                        ) : hasError ? (
                            <AlertCircle className="w-4 h-4 text-[var(--error)]" />
                        ) : isSuccess ? (
                            <Check className="w-4 h-4 text-[var(--success)]" />
                        ) : null}
                    </div>
                </div>

                {/* Resolved info */}
                {(resolvedAddress || resolvedEnsName) && !hasError && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        {resolvedAddress && isENSName && (
                            <span>
                                Resolves to:{" "}
                                <span className="font-mono text-[var(--success)]">
                                    {`${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`}
                                </span>
                            </span>
                        )}
                        {resolvedEnsName && isValidAddress && (
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="text-[var(--base-blue)] font-medium">
                                    {resolvedEnsName}
                                </span>
                            </span>
                        )}
                    </div>
                )}

                {/* Error / Hint */}
                {(errorMessage || hint) && (
                    <p
                        className={`text-xs ${errorMessage ? "text-[var(--error)]" : "text-[var(--muted-foreground)]"
                            }`}
                    >
                        {errorMessage || hint}
                    </p>
                )}
            </div>
        );
    }
);

ENSInput.displayName = "ENSInput";
