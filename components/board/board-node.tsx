"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  BookOpen,
  Bot,
  Clock,
  Cpu,
  Database,
  Globe,
  KeyRound,
  Mail,
  Package,
  Send,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BoardNodeKind =
  | "agent"
  | "instructions"
  | "tool"
  | "orchestrator"
  | "swarm"
  | "memory"
  | "trigger"
  | "input"
  | "processor"
  | "output"
  | "dependency"
  | "credentials";

export type BoardNodeData = {
  label: string;
  subtitle?: string;
  detail?: string;
  kind: BoardNodeKind;
  isNew?: boolean;
  animDelay?: number;
  placeholder?: boolean;
  isUpdated?: boolean;
  memoryReads?: string[];
  memoryWrites?: string[];
};

const NODE_THEMES: Record<
  BoardNodeKind,
  {
    accent: string;
    accentRgba: string;
    glow: string;
    icon: typeof Bot;
    tag: string;
  }
> = {
  agent: {
    accent: "#8b5cf6",
    accentRgba: "139,92,246",
    glow: "rgba(139,92,246,0.35)",
    icon: Bot,
    tag: "Agent",
  },
  orchestrator: {
    accent: "#6366f1",
    accentRgba: "99,102,241",
    glow: "rgba(99,102,241,0.35)",
    icon: Users,
    tag: "Orchestrator",
  },
  instructions: {
    accent: "#3b82f6",
    accentRgba: "59,130,246",
    glow: "rgba(59,130,246,0.35)",
    icon: BookOpen,
    tag: "Prompt",
  },
  tool: {
    accent: "#10b981",
    accentRgba: "16,185,129",
    glow: "rgba(16,185,129,0.35)",
    icon: Wrench,
    tag: "Tool",
  },
  swarm: {
    accent: "#f59e0b",
    accentRgba: "245,158,11",
    glow: "rgba(245,158,11,0.35)",
    icon: Sparkles,
    tag: "Sub-agent",
  },
  trigger: {
    accent: "#f59e0b",
    accentRgba: "245,158,11",
    glow: "rgba(245,158,11,0.35)",
    icon: Clock,
    tag: "Trigger",
  },
  input: {
    accent: "#06b6d4",
    accentRgba: "6,182,212",
    glow: "rgba(6,182,212,0.35)",
    icon: Database,
    tag: "Input",
  },
  processor: {
    accent: "#3b82f6",
    accentRgba: "59,130,246",
    glow: "rgba(59,130,246,0.35)",
    icon: Cpu,
    tag: "Processor",
  },
  output: {
    accent: "#10b981",
    accentRgba: "16,185,129",
    glow: "rgba(16,185,129,0.35)",
    icon: Send,
    tag: "Output",
  },
  dependency: {
    accent: "#8b5cf6",
    accentRgba: "139,92,246",
    glow: "rgba(139,92,246,0.35)",
    icon: Package,
    tag: "Dep",
  },
  credentials: {
    accent: "#f59e0b",
    accentRgba: "245,158,11",
    glow: "rgba(245,158,11,0.35)",
    icon: KeyRound,
    tag: "Credentials",
  },
  memory: {
    accent: "#f59e0b",
    accentRgba: "245,158,11",
    glow: "rgba(245,158,11,0.35)",
    icon: Database,
    tag: "Memory",
  },
};

function ToolIcon({ name, color }: { name: string; color: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("search") || lower.includes("web")) {
    return <Globe className="size-3.5 shrink-0" style={{ color }} strokeWidth={2} />;
  }
  if (lower.includes("mail") || lower.includes("gmail") || lower.includes("email") || lower.includes("digest")) {
    return <Mail className="size-3.5 shrink-0" style={{ color }} strokeWidth={2} />;
  }
  if (lower.includes("send") || lower.includes("slack")) {
    return <Send className="size-3.5 shrink-0" style={{ color }} strokeWidth={2} />;
  }
  return <Wrench className="size-3.5 shrink-0" style={{ color }} strokeWidth={2} />;
}

export function BoardNode({ data }: NodeProps<Node<BoardNodeData>>) {
  const theme = NODE_THEMES[data.kind];
  const Icon = data.kind === "tool" ? null : theme.icon;
  const isPlaceholder = data.placeholder;
  const hasMemoryBadges =
    (data.memoryReads?.length ?? 0) > 0 || (data.memoryWrites?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        "board-node group relative w-[256px] overflow-visible rounded-2xl transition-all duration-300",
        isPlaceholder ? "opacity-40" : "hover:-translate-y-0.5",
        data.isNew && !isPlaceholder && "agent-node-spawn",
        data.isUpdated && !isPlaceholder && "memory-node-flash"
      )}
      style={
        data.isNew && data.animDelay !== undefined
          ? { animationDelay: `${data.animDelay}ms` }
          : undefined
      }
    >
      {/* Glow halo */}
      {!isPlaceholder && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-80"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${theme.glow}, transparent 70%)`,
          }}
        />
      )}

      {/* Gradient border wrapper */}
      <div
        className={cn(
          "relative rounded-2xl p-px transition-all duration-300",
          isPlaceholder
            ? "bg-white/[0.06]"
            : "shadow-[0_8px_32px_rgba(0,0,0,0.45)] group-hover:shadow-[0_12px_44px_rgba(0,0,0,0.6)]"
        )}
        style={
          isPlaceholder
            ? undefined
            : {
                background: `linear-gradient(135deg, ${theme.accent} 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 60%, ${theme.accent}40 100%)`,
              }
        }
      >
        {/* Inner card */}
        <div
          className={cn(
            "relative overflow-hidden rounded-[15px]",
            isPlaceholder
              ? "border border-dashed border-white/10 bg-[#1a1816]/60"
              : "bg-gradient-to-b from-[#1f1d22] to-[#16141a]"
          )}
        >
          {/* Header row */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            {/* Color chip + icon */}
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              style={{
                background: `linear-gradient(135deg, ${theme.accent} 0%, rgba(${theme.accentRgba},0.6) 100%)`,
              }}
            >
              {data.kind === "tool" ? (
                <ToolIcon name={data.label} color="white" />
              ) : (
                Icon && (
                  <Icon
                    className="size-3.5 shrink-0 text-white"
                    strokeWidth={2.2}
                  />
                )
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                {data.label}
              </p>
              {data.subtitle && (
                <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground/85">
                  {data.subtitle}
                </p>
              )}
            </div>

            {/* Status dot (top-right) */}
            {!isPlaceholder && (
              <div
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `0 0 6px ${theme.glow}`,
                }}
                aria-hidden
              />
            )}
          </div>

          {/* Body */}
          {(data.detail || isPlaceholder) && (
            <div className="border-t border-white/[0.05] px-3.5 py-2.5">
              {data.detail ? (
                <p className="line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  {data.detail}
                </p>
              ) : (
                <p className="text-[11.5px] italic text-muted-foreground/55">
                  Waiting to be configured…
                </p>
              )}
            </div>
          )}

          {/* Memory read/write badges */}
          {!isPlaceholder && hasMemoryBadges && (
            <div className="border-t border-white/[0.04] px-3 py-1.5 space-y-0.5">
              {data.memoryReads?.map((k) => (
                <p key={`r-${k}`} className="font-mono text-[9px] text-blue-400/80">
                  ↓ reads: {k}
                </p>
              ))}
              {data.memoryWrites?.map((k) => (
                <p key={`w-${k}`} className="font-mono text-[9px] text-amber-400/80">
                  ↑ writes: {k}
                </p>
              ))}
            </div>
          )}

          {/* Tag pill (bottom-right) */}
          {!isPlaceholder && (
            <div className="flex items-center justify-end border-t border-white/[0.04] bg-white/[0.015] px-3 py-1.5">
              <span
                className="font-mono text-[9px] uppercase tracking-[0.14em]"
                style={{ color: `rgba(${theme.accentRgba}, 0.85)` }}
              >
                {theme.tag}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Handles */}
      {!isPlaceholder && data.kind !== "agent" && data.kind !== "orchestrator" && data.kind !== "trigger" && (
        <Handle
          type="target"
          position={
            data.kind === "tool" || data.kind === "swarm" || data.kind === "memory"
              ? Position.Top
              : Position.Left
          }
          className="!size-2 !border !border-white/30"
          style={{
            backgroundColor: theme.accent,
            ...(data.kind === "tool" || data.kind === "swarm" || data.kind === "memory"
              ? { top: -4 }
              : { left: -4 }),
          }}
        />
      )}

      {!isPlaceholder && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2 !border !border-white/30"
          style={{ backgroundColor: theme.accent, right: -4 }}
        />
      )}

      {(data.kind === "agent" || data.kind === "orchestrator" || data.kind === "trigger") && !isPlaceholder ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!size-2 !border !border-white/30"
          style={{ backgroundColor: theme.accent, bottom: -4 }}
        />
      ) : null}
    </div>
  );
}
