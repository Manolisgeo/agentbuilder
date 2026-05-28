"use client";

import { cn } from "@/lib/utils";
import type { BuildStage } from "@/lib/build-progress";

const STEPS: { key: BuildStage; label: string }[] = [
  { key: "persona", label: "Persona" },
  { key: "tools", label: "Tools" },
  { key: "instructions", label: "Instructions" },
];

interface BuildStepperProps {
  stages: Record<BuildStage, boolean>;
}

export function BuildStepper({ stages }: BuildStepperProps) {
  const completedCount = STEPS.filter((s) => stages[s.key]).length;
  const trackFill = (completedCount / STEPS.length) * 100;

  return (
    <div className="relative mt-8 w-full max-w-xs">
      <div className="absolute left-[16%] right-[16%] top-4 h-px bg-white/[0.06]">
        <div
          className="h-full bg-gradient-to-r from-primary/80 to-primary/40 transition-all duration-700 ease-out"
          style={{ width: `${trackFill}%` }}
        />
      </div>

      <div className="relative flex justify-between">
        {STEPS.map((step, index) => {
          const done = stages[step.key];
          const active = !done && index === completedCount;
          return (
            <div
              key={step.key}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full border font-mono text-[10px] transition-all duration-300",
                  done
                    ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(255,107,26,0.25)]"
                    : active
                      ? "border-system/40 bg-system/5 text-system idle-pulse"
                      : "border-white/[0.08] bg-surface-2 text-muted-foreground"
                )}
              >
                {index + 1}
                {active && (
                  <span className="absolute inset-0 rounded-full ring-1 ring-system/30" />
                )}
              </div>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-[0.15em]",
                  done ? "text-primary/90" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
