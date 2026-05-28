"use client";

import { ChevronDown, ChevronUp, Database } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SwarmMemoryKey } from "@/lib/agent-spec";
import type { SwarmMemoryState } from "@/lib/swarm-memory";

interface MemoryPanelProps {
  keys: SwarmMemoryKey[];
  state: SwarmMemoryState;
  lastWrittenBy: Record<string, string>;
  latestWrittenKeys?: Set<string>;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "(empty)";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function MemoryKeyRow({
  mk,
  value,
  writtenBy,
  isFlashing,
}: {
  mk: SwarmMemoryKey;
  value: unknown;
  writtenBy?: string;
  isFlashing: boolean;
}) {
  const isEmpty = value === undefined || value === null;
  const displayValue = formatValue(value);
  const isLong = displayValue.length > 80;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 transition-all duration-300",
        isFlashing
          ? "border-amber-500/40 bg-amber-500/[0.08]"
          : "border-black/[0.06] bg-black/[0.02] dark:border-white/[0.06] dark:bg-white/[0.02]"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] font-semibold text-foreground/90 truncate">
            {mk.key}
          </span>
          <span
            className={cn(
              "shrink-0 rounded px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider",
              isEmpty
                ? "bg-black/[0.04] text-muted-foreground/60 dark:bg-white/[0.04]"
                : "bg-amber-500/15 text-amber-400/90"
            )}
          >
            {mk.type}
          </span>
        </div>
        {isFlashing && (
          <span className="shrink-0 size-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
        )}
      </div>

      {isEmpty ? (
        <p className="text-[10.5px] italic text-muted-foreground/50">(empty)</p>
      ) : (
        <>
          <p
            className={cn(
              "text-[10.5px] leading-relaxed text-muted-foreground font-mono whitespace-pre-wrap break-all",
              !expanded && isLong && "line-clamp-2"
            )}
          >
            {displayValue}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 flex items-center gap-0.5 text-[9px] text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-2.5" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="size-2.5" /> Show more
                </>
              )}
            </button>
          )}
        </>
      )}

      {writtenBy && (
        <p className="mt-1 font-mono text-[9px] text-muted-foreground/50">
          ← written by {writtenBy}
        </p>
      )}
    </div>
  );
}

export function MemoryPanel({
  keys,
  state,
  lastWrittenBy,
  latestWrittenKeys,
}: MemoryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [flashingKeys, setFlashingKeys] = useState<Set<string>>(new Set());
  const prevLatestRef = useRef<Set<string> | undefined>(undefined);

  useEffect(() => {
    if (!latestWrittenKeys?.size) return;
    const prev = prevLatestRef.current;
    const isNew =
      !prev ||
      [...latestWrittenKeys].some((k) => !prev.has(k));
    if (!isNew) return;
    prevLatestRef.current = latestWrittenKeys;
    setFlashingKeys(latestWrittenKeys);
    const timer = setTimeout(() => setFlashingKeys(new Set()), 1200);
    return () => clearTimeout(timer);
  }, [latestWrittenKeys]);

  if (keys.length === 0) return null;

  return (
    <div className="inner-card p-3.5">
      <button
        type="button"
        className="mb-2 flex w-full items-center gap-2"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Database className="size-3 text-amber-400/80" />
        <p className="hud-label flex-1 text-left">Shared Memory</p>
        <div className="h-px flex-1 bg-gradient-to-r from-black/[0.07] to-transparent dark:from-white/[0.08]" />
        {collapsed ? (
          <ChevronDown className="size-3 text-muted-foreground/60" />
        ) : (
          <ChevronUp className="size-3 text-muted-foreground/60" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {keys.map((mk) => (
            <MemoryKeyRow
              key={mk.key}
              mk={mk}
              value={state[mk.key]}
              writtenBy={lastWrittenBy[mk.key]}
              isFlashing={flashingKeys.has(mk.key)}
            />
          ))}
        </div>
      )}

      {collapsed && (
        <p className="text-[10.5px] text-muted-foreground/60">
          {keys.length} key{keys.length !== 1 ? "s" : ""} ·{" "}
          {Object.keys(state).length} populated
        </p>
      )}
    </div>
  );
}
