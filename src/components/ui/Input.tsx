"use client";

import { forwardRef, useState } from "react";
import { AlertCircle, Check } from "lucide-react";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    isSuccess?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            hint,
            leftIcon,
            rightIcon,
            isSuccess,
            className = "",
            id,
            ...props
        },
        ref
    ) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
        const [isFocused, setIsFocused] = useState(false);

        const getInputStyles = () => {
            if (error) {
                return "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error-light)]";
            }
            if (isSuccess) {
                return "border-[var(--success)] focus:border-[var(--success)] focus:ring-[var(--success-light)]";
            }
            return "border-[var(--input)] focus:border-[var(--base-blue)] focus:ring-[var(--base-blue-50)]";
        };

        return (
            <div className="flex flex-col gap-2">
                {label && (
                    <label
                        htmlFor={inputId}
                        className={`text-sm font-medium transition-colors ${isFocused
                                ? error
                                    ? "text-[var(--error)]"
                                    : "text-[var(--base-blue)]"
                                : "text-[var(--foreground)]"
                            }`}
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        className={`
              h-11 w-full rounded-xl
              bg-[var(--card)]
              px-3 text-sm
              border
              outline-none
              transition-all duration-200
              placeholder:text-[var(--muted-foreground)]
              focus:ring-[3px]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon || error || isSuccess ? "pr-10" : ""}
              ${getInputStyles()}
              ${className}
            `}
                        {...props}
                    />
                    {(rightIcon || error || isSuccess) && (
                        <div
                            className={`absolute right-3 top-1/2 -translate-y-1/2 ${error
                                    ? "text-[var(--error)]"
                                    : isSuccess
                                        ? "text-[var(--success)]"
                                        : "text-[var(--muted-foreground)]"
                                }`}
                        >
                            {error ? (
                                <AlertCircle className="w-4 h-4" />
                            ) : isSuccess ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                rightIcon
                            )}
                        </div>
                    )}
                </div>
                {(error || hint) && (
                    <p
                        className={`text-xs ${error ? "text-[var(--error)]" : "text-[var(--muted-foreground)]"
                            }`}
                    >
                        {error || hint}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, hint, className = "", id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
        const [isFocused, setIsFocused] = useState(false);

        const getInputStyles = () => {
            if (error) {
                return "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error-light)]";
            }
            return "border-[var(--input)] focus:border-[var(--base-blue)] focus:ring-[var(--base-blue-50)]";
        };

        return (
            <div className="flex flex-col gap-2">
                {label && (
                    <label
                        htmlFor={inputId}
                        className={`text-sm font-medium transition-colors ${isFocused
                                ? error
                                    ? "text-[var(--error)]"
                                    : "text-[var(--base-blue)]"
                                : "text-[var(--foreground)]"
                            }`}
                    >
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={inputId}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className={`
            w-full min-h-[100px] rounded-xl
            bg-[var(--card)]
            px-3 py-3 text-sm
            border
            outline-none
            transition-all duration-200
            placeholder:text-[var(--muted-foreground)]
            focus:ring-[3px]
            resize-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${getInputStyles()}
            ${className}
          `}
                    {...props}
                />
                {(error || hint) && (
                    <p
                        className={`text-xs ${error ? "text-[var(--error)]" : "text-[var(--muted-foreground)]"
                            }`}
                    >
                        {error || hint}
                    </p>
                )}
            </div>
        );
    }
);

Textarea.displayName = "Textarea";
