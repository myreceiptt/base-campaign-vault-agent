"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextType {
    addToast: (type: ToastType, message: string) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((type: ToastType, message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, type, message }]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    }, [removeToast]);

    const success = useCallback((message: string) => addToast("success", message), [addToast]);
    const error = useCallback((message: string) => addToast("error", message), [addToast]);
    const info = useCallback((message: string) => addToast("info", message), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, success, error, info, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-[var(--success)]" />,
        error: <AlertCircle className="w-5 h-5 text-[var(--error)]" />,
        info: <Info className="w-5 h-5 text-[var(--base-blue)]" />,
    };

    const bgColors = {
        success: "bg-[var(--success)]/10 border-[var(--success)]/20",
        error: "bg-[var(--error)]/10 border-[var(--error)]/20",
        info: "bg-[var(--base-blue)]/10 border-[var(--base-blue)]/20",
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`
        pointer-events-auto
        flex items-start gap-3 
        min-w-[300px] max-w-[400px]
        p-4 rounded-xl
        backdrop-blur-xl border
        shadow-lg
        ${bgColors[toast.type]}
      `}
        >
            <div className="mt-0.5 shrink-0">{icons[toast.type]}</div>
            <p className="text-sm font-medium text-white/90 leading-tight">{toast.message}</p>
            <button
                onClick={onDismiss}
                className="ml-auto shrink-0 text-white/50 hover:text-white transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
