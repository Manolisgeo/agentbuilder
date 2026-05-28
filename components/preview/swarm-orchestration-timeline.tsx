"use client";

import {
  ArrowRight,
  Bot,
  Globe,
  Network,
  Sparkles,
} from "lucide-react";
import { WebSearchDisplay } from "@/components/preview/web-search-display";
import type { OrchestrationStep } from "@/lib/preview-types";
import { cn } from "@/lib/utils";

interface SwarmOrchestrationTimelineProps {
  steps: OrchestrationStep[];
  isActive?: boolean;
}

const kindIcons = {
  routing: Network,
  delegate: Bot,
  tool: Globe,
  synthesize: Sparkles,
} as const;

function stepAccent(kind: OrchestrationStep["kind"], status: OrchestrationStep["status"]) {
  if (status === "error") return "border-destructive/35 bg-destructive/[0.06] text-destructive";
  if (status === "active") {
    if (kind === "tool") return "border-system/40 bg-system/[0.08] text-system";
    if (kind === "synthesize") return "border-violet/40 bg-violet/[0.08] text-violet-200";
    return "border-primary/40 bg-primary/[0.08] text-primary";
  }
  if (status === "done") return "border-black/[0.08] bg-black/[0.03] text-foreground/85 dark:border-white/[0.08] dark:bg-white/[0.03]";
  return "border-black/[0.05] bg-transparent text-muted-foreground dark:border-white/[0.05]";
}

export function SwarmOrchestrationTimeline({
  steps,
  isActive = false,
}: SwarmOrchestrationTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-violet/20 bg-gradient-to-br from-violet/[0.08] via-transparent to-transparent">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2 dark:border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Network className="size-3.5 text-violet-300" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-200/90">
            Swarm orchestration
          </span>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-violet-300/80">
            <span className="size-1 rounded-full bg-violet-300 [animation:idle-pulse_1s_ease-in-out_infinite]" />
            Live
          </span>
        )}
      </div>

      <div className="space-y-0 px-3 py-3">
        {steps.map((step, index) => {
          const Icon = kindIcons[step.kind];
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-black/[0.12] to-transparent dark:from-white/[0.12]" />
              )}

              <div
                className={cn(
                  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                  stepAccent(step.kind, step.status),
                  step.status === "active" && "shadow-[0_0_14px_-2px_rgba(139,92,246,0.45)]"
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                {step.status === "active" && (
                  <span className="absolute inset-0 rounded-full ring-1 ring-violet/30 [animation:idle-pulse_1.4s_ease-in-out_infinite]" />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12.5px] font-medium text-foreground/90">
                    {step.label}
                  </p>
                  {step.agentRole && (
                    <span className="rounded-full border border-black/[0.07] bg-black/[0.03] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.03]">
                      {step.agentRole}
                    </span>
                  )}
                  {step.status === "done" && (
                    <ArrowRight className="size-3 text-muted-foreground/50" />
                  )}
                </div>

                {step.detail && (
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                )}

                {step.searchResult && step.kind === "tool" && (
                  <div className="mt-2.5">
                    <WebSearchDisplay result={step.searchResult} compact />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
