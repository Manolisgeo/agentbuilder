"use client";

import { ChevronDown, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { WebSearchToolOutput } from "@/components/preview/web-search-display";
import { PlanSteps } from "@/components/chat/plan-steps";
import { TOOL_LABELS } from "@/lib/chat-types";
import type { AgentPlan, PlanStepStatus } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

interface ToolCallDisplayProps {
  toolName: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  stepOverrides?: Record<string, PlanStepStatus>;
}

function ToolBadge({
  label,
  isDone,
  icon: Icon = Sparkles,
}: {
  label: string;
  isDone: boolean;
  icon?: typeof Sparkles;
}) {
  return (
    <div
      className={cn(
        "my-2 flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]",
        isDone
          ? "border-primary/25 bg-primary/[0.06] text-primary/85"
          : "border-system/30 bg-system/[0.06] text-system"
      )}
    >
      <span
        className={cn(
          "relative flex size-1.5 shrink-0 items-center justify-center",
          !isDone &&
            "before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-system/40"
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            isDone ? "bg-primary" : "bg-system"
          )}
        />
      </span>
      <Icon className="size-3 opacity-70" aria-hidden />
      <span>{label}</span>
      {!isDone && (
        <span className="ml-auto inline-flex gap-0.5">
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_infinite]" />
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.2s_infinite]" />
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.4s_infinite]" />
        </span>
      )}
    </div>
  );
}

function ResearchDisplay({
  topic,
  findings,
  isDone,
}: {
  topic: string;
  findings: string;
  isDone: boolean;
}) {
  const [expanded, setExpanded] = useState(!isDone);

  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-system/20 bg-system/[0.03]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02]"
      >
        <Search className="size-3.5 shrink-0 text-system" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground/90">
          Research: {topic}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-white/[0.05] px-3 py-2.5">
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/80">
            {findings}
          </p>
        </div>
      )}
    </div>
  );
}

export function ToolCallDisplay({
  toolName,
  state,
  input,
  output,
  stepOverrides,
}: ToolCallDisplayProps) {
  const isDone = state === "output-available" || state === "output-error";
  const labels = TOOL_LABELS[toolName];

  if (toolName === "createPlan" && isDone && output && typeof output === "object") {
    const plan = output as AgentPlan;
    return <PlanSteps plan={plan} stepOverrides={stepOverrides} />;
  }

  if (toolName === "web_search") {
    const queryHint =
      input && typeof input === "object" && "query" in (input as object)
        ? String((input as { query: string }).query)
        : undefined;

    return (
      <WebSearchToolOutput
        output={output}
        isDone={isDone}
        queryHint={queryHint}
      />
    );
  }

  if (toolName === "researchTopic" && isDone && output && typeof output === "object") {
    const { topic, findings } = output as { topic: string; findings: string };
    return (
      <ResearchDisplay topic={topic} findings={findings} isDone={isDone} />
    );
  }

  const detail =
    isDone && output && typeof output === "object"
      ? "nodeId" in (output as object)
        ? String((output as { nodeId?: string }).nodeId)
        : "name" in (output as object)
          ? String((output as { name?: string }).name)
          : undefined
      : input && typeof input === "object" && "topic" in (input as object)
        ? String((input as { topic: string }).topic)
        : undefined;

  const label = labels
    ? isDone
      ? labels.done
      : labels.active
    : isDone
      ? `${toolName} complete`
      : `Running ${toolName}`;

  return (
    <div>
      <ToolBadge
        label={detail ? `${label} · ${detail}` : label}
        isDone={isDone}
        icon={toolName === "researchTopic" ? Search : Sparkles}
      />
    </div>
  );
}
