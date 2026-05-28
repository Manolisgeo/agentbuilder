"use client";

import { ChevronDown, Search, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { WebSearchToolOutput } from "@/components/preview/web-search-display";
import { PlanSteps } from "@/components/chat/plan-steps";
import { TOOL_LABELS } from "@/lib/chat-types";
import type { AgentPlan, PlanStepStatus } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

// Tools that mutate the agent spec — grouped into a single summary pill.
export const SPEC_TOOLS = new Set([
  "updatePersona",
  "updateInstructions",
  "addTool",
  "removeTool",
  "addSubAgent",
  "updateSubAgent",
  "removeSubAgent",
  "updateAgentSpec",
  "updateMemoryKeys",
  "setEnvVar",
  "updateAgentUi",
  "updateDeploymentPlatform",
  "updateDeploymentCode",
]);

interface SpecToolPart {
  toolName: string;
  state?: string;
  input?: unknown;
  output?: unknown;
}

export function SpecUpdateGroup({
  parts,
  isStreaming,
}: {
  parts: SpecToolPart[];
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const doneParts = parts.filter(
    (p) => p.state === "output-available" || p.state === "output-error"
  );
  const activePart = parts.find(
    (p) => p.state !== "output-available" && p.state !== "output-error"
  );

  const allDone = !activePart;

  // Build summary label from done parts.
  const counts: Record<string, number> = {};
  for (const p of doneParts) {
    counts[p.toolName] = (counts[p.toolName] ?? 0) + 1;
  }
  const summaryFragments = Object.entries(counts).map(([name, n]) => {
    const label = TOOL_LABELS[name]?.done ?? name;
    return n > 1 ? `${label} ×${n}` : label;
  });

  const totalDone = doneParts.length;

  if (parts.length === 0) return null;

  // While streaming: show only the current active tool (or last done if nothing active)
  const liveLabel = activePart
    ? (TOOL_LABELS[activePart.toolName]?.active ?? `Running ${activePart.toolName}`)
    : (TOOL_LABELS[parts[parts.length - 1]?.toolName ?? ""]?.done ?? "Done");

  return (
    <div className="my-2">
      {/* Collapsed / streaming pill */}
      <button
        type="button"
        onClick={() => allDone && setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-left transition-colors",
          allDone
            ? "border-primary/25 bg-primary/[0.06] text-primary/85 hover:bg-primary/10 cursor-pointer"
            : "border-system/30 bg-system/[0.06] text-system cursor-default"
        )}
      >
        {/* Status dot */}
        <span className="relative flex size-1.5 shrink-0 items-center justify-center">
          {!allDone && (
            <span className="absolute inset-0 animate-ping rounded-full bg-system/40" />
          )}
          <span
            className={cn(
              "size-1.5 rounded-full",
              allDone ? "bg-primary" : "bg-system"
            )}
          />
        </span>

        <Zap className="size-3 opacity-70 shrink-0" aria-hidden />

        <span className="flex-1 truncate">
          {allDone
            ? totalDone === 1
              ? summaryFragments[0]
              : `${totalDone} changes · ${summaryFragments.join(", ")}`
            : liveLabel}
        </span>

        {!allDone && (
          <span className="ml-auto inline-flex gap-0.5">
            <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_infinite]" />
            <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.2s_infinite]" />
            <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.4s_infinite]" />
          </span>
        )}

        {allDone && totalDone > 1 && (
          <ChevronDown
            className={cn(
              "ml-auto size-3 shrink-0 opacity-50 transition-transform",
              expanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expanded individual items */}
      {expanded && allDone && (
        <div className="mt-1 space-y-0.5 pl-3">
          {parts.map((part, i) => {
            const label = TOOL_LABELS[part.toolName]?.done ?? part.toolName;
            const detail =
              part.output && typeof part.output === "object"
                ? "nodeId" in (part.output as object)
                  ? String((part.output as { nodeId?: string }).nodeId)
                  : "name" in (part.output as object)
                    ? String((part.output as { name?: string }).name)
                    : undefined
                : part.input && typeof part.input === "object" && "topic" in (part.input as object)
                  ? String((part.input as { topic: string }).topic)
                  : undefined;
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-primary/70"
              >
                <span className="size-1 rounded-full bg-primary/50 shrink-0" />
                <span className="truncate">{detail ? `${label} · ${detail}` : label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
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
        <div className="border-t border-black/[0.05] px-3 py-2.5 dark:border-white/[0.05]">
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
