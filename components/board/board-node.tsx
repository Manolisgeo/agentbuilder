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
  Globe,
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
  | "swarm";

export type BoardNodeData = {
  label: string;
  subtitle?: string;
  detail?: string;
  kind: BoardNodeKind;
  isNew?: boolean;
  animDelay?: number;
  placeholder?: boolean;
};

const NODE_THEMES: Record<
  BoardNodeKind,
  { accent: string; icon: typeof Bot; tag: string }
> = {
  agent: { accent: "#8b5cf6", icon: Bot, tag: "Agent" },
  orchestrator: { accent: "#6366f1", icon: Users, tag: "Orchestrator" },
  instructions: { accent: "#3b82f6", icon: BookOpen, tag: "Prompt" },
  tool: { accent: "#10b981", icon: Wrench, tag: "Tool" },
  swarm: { accent: "#f59e0b", icon: Sparkles, tag: "Sub-agent" },
};

function ToolIcon({ name }: { name: string }) {
  if (name.toLowerCase().includes("search") || name.toLowerCase().includes("web")) {
    return <Globe className="size-3.5 shrink-0 text-white" strokeWidth={2} />;
  }
  return <Wrench className="size-3.5 shrink-0 text-white" strokeWidth={2} />;
}

export function BoardNode({ data }: NodeProps<Node<BoardNodeData>>) {
  const theme = NODE_THEMES[data.kind];
  const Icon = data.kind === "tool" ? null : theme.icon;
  const isPlaceholder = data.placeholder;

  return (
    <div
      className={cn(
        "board-node group w-[248px] overflow-hidden rounded-xl border bg-surface-2 shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-shadow",
        isPlaceholder
          ? "border-dashed border-white/10 opacity-45"
          : "border-white/10 hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
        data.isNew && !isPlaceholder && "agent-node-spawn agent-node-glow"
      )}
      style={
        data.isNew && data.animDelay !== undefined
          ? { animationDelay: `${data.animDelay}ms` }
          : undefined
      }
    >
      {!isPlaceholder && data.kind !== "agent" && data.kind !== "orchestrator" && (
        <Handle
          type="target"
          position={
            data.kind === "tool" || data.kind === "swarm"
              ? Position.Top
              : Position.Left
          }
          className="!size-2.5 !border-2 !border-surface-2 !bg-white/80"
          style={
            data.kind === "tool" || data.kind === "swarm"
              ? { top: -5 }
              : { left: -5 }
          }
        />
      )}

      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ backgroundColor: theme.accent }}
      >
        {data.kind === "tool" ? (
          <ToolIcon name={data.label} />
        ) : (
          Icon && <Icon className="size-3.5 shrink-0 text-white" strokeWidth={2} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            {data.label}
          </p>
        </div>
        <span className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white/85">
          {theme.tag}
        </span>
      </div>

      <div className="border-t border-white/[0.04] px-3 py-2.5">
        {data.subtitle && (
          <p className="truncate text-[11px] font-medium text-foreground/80">
            {data.subtitle}
          </p>
        )}
        {data.detail ? (
          <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
            {data.detail}
          </p>
        ) : isPlaceholder ? (
          <p className="text-[11px] italic text-muted-foreground/60">
            Waiting to be configured…
          </p>
        ) : null}
      </div>

      {!isPlaceholder && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !-right-[5px] !border-2 !border-surface-2"
          style={{ backgroundColor: theme.accent }}
        />
      )}

      {data.kind === "agent" || data.kind === "orchestrator" ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!size-2.5 !border-2 !border-surface-2"
          style={{ backgroundColor: theme.accent }}
        />
      ) : null}
    </div>
  );
}
