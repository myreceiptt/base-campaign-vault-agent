"use client";

import { Check, Lock } from "lucide-react";
import { motion } from "framer-motion";

export type StepStatus = "completed" | "active" | "pending" | "locked";

export interface Step {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  icon?: React.ReactNode;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full">
      {/* Desktop Stepper */}
      <div className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <StepIndicator
              step={step}
              isActive={step.id === currentStep}
              onClick={() => onStepClick?.(step.id)}
            />
            {index < steps.length - 1 && (
              <StepConnector isCompleted={step.status === "completed"} />
            )}
          </div>
        ))}
      </div>

      {/* Mobile Stepper */}
      <div className="md:hidden flex flex-col gap-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <StepIndicator
                step={step}
                isActive={step.id === currentStep}
                onClick={() => onStepClick?.(step.id)}
                compact
              />
              {index < steps.length - 1 && (
                <div
                  className={`w-0.5 h-8 mt-2 transition-colors ${step.status === "completed"
                    ? "bg-[var(--success)]"
                    : "bg-[var(--border)]"
                    }`}
                />
              )}
            </div>
            <div className="flex-1 pt-1">
              <h3
                className={`font-medium text-sm transition-colors ${step.status === "active"
                  ? "text-[var(--base-blue)]"
                  : step.status === "completed"
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)]"
                  }`}
              >
                {step.title}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  step: Step;
  isActive: boolean;
  onClick?: () => void;
  compact?: boolean;
}

function StepIndicator({
  step,
  isActive,
  onClick,
  compact = false,
}: StepIndicatorProps) {
  const canClick = step.status === "completed" || step.status === "active";
  const size = compact ? "w-10 h-10" : "w-12 h-12";

  const getStatusStyles = () => {
    switch (step.status) {
      case "completed":
        return "bg-[var(--success)] text-white";
      case "active":
        return "bg-[var(--base-blue)] text-white shadow-[0_0_0_4px_var(--base-blue-100)]";
      case "pending":
        return "bg-[var(--muted)] text-[var(--muted-foreground)]";
      case "locked":
        return "bg-[var(--muted)] text-[var(--muted-foreground)] opacity-50";
      default:
        return "bg-[var(--muted)] text-[var(--muted-foreground)]";
    }
  };

  const content = () => {
    if (step.status === "completed") {
      return <Check className="w-5 h-5" />;
    }
    if (step.status === "locked") {
      return <Lock className="w-4 h-4" />;
    }
    if (step.icon) {
      return step.icon;
    }
    return <span className="text-sm font-bold">{String(step.id).padStart(2, "0")}</span>;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={canClick ? onClick : undefined}
        disabled={!canClick}
        className={`
          ${size} rounded-full flex items-center justify-center
          font-semibold transition-all duration-200 relative z-10
          ${getStatusStyles()}
          ${canClick ? "cursor-pointer hover:scale-105" : "cursor-default"}
        `}
      >
        {isActive && (
          <motion.div
            layoutId="active-step-glow"
            className="absolute inset-0 rounded-full bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.5)] z-[-1]"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        {content()}
      </button>
      {!compact && (
        <div className="text-center min-w-[100px]">
          <p
            className={`text-xs font-medium transition-colors ${isActive
              ? "text-[var(--base-blue)]"
              : step.status === "completed"
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)]"
              }`}
          >
            {step.title}
          </p>
        </div>
      )}
    </div>
  );
}

interface StepConnectorProps {
  isCompleted: boolean;
}

function StepConnector({ isCompleted }: StepConnectorProps) {
  return (
    <div
      className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${isCompleted ? "bg-[var(--success)]" : "bg-[var(--border)]"
        }`}
    />
  );
}
