"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentPlan, PlanStepStatus } from "@/lib/chat-types";

interface PlanStepsProps {
  plan: AgentPlan;
  stepOverrides?: Record<string, PlanStepStatus>;
}

function StepIcon({ status }: { status: PlanStepStatus }) {
  if (status === "completed") {
    return (
      <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
        <Check className="size-2.5" strokeWidth={3} />
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <Loader2
        className="size-4 shrink-0 animate-spin text-system"
        strokeWidth={2.5}
      />
    );
  }
  return (
    <Circle
      className="size-4 shrink-0 text-muted-foreground/40"
      strokeWidth={1.5}
    />
  );
}

export function PlanSteps({ plan, stepOverrides = {} }: PlanStepsProps) {
  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
          Plan
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-foreground/90">
          {plan.title}
        </p>
      </div>
      <ol className="space-y-0 divide-y divide-white/[0.04]">
        {plan.steps.map((step, index) => {
          const status =
            stepOverrides[step.id] ?? step.status ?? "pending";
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-2.5 px-3 py-2.5 transition-colors",
                status === "in_progress" && "bg-system/[0.04]",
                status === "completed" && "opacity-70"
              )}
            >
              <StepIcon status={status} />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] leading-snug",
                    status === "completed"
                      ? "text-muted-foreground line-through"
                      : "text-foreground/90"
                  )}
                >
                  <span className="mr-1.5 font-mono text-[10px] text-muted-foreground/60">
                    {index + 1}.
                  </span>
                  {step.title}
                </p>
                {step.description && status !== "completed" && (
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground/80">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
