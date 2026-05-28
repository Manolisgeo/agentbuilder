"use client";

import { Loader2, MessageSquare, MousePointer2, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HudPanel } from "@/components/hud/hud-panel";
import { updateDeploymentFiles } from "@/lib/agent-mutations";
import type { AgentSpec } from "@/lib/agent-spec";
import { getAgentFrontendHtml } from "@/lib/frontend-codegen";
import type { DesignSelection } from "@/lib/design-inspector";

interface DesignElementChatProps {
  agentSpec: AgentSpec;
  selection: DesignSelection | null;
  onClearSelection: () => void;
  onSpecUpdate: (spec: AgentSpec) => void;
  disabled?: boolean;
}

async function parseJsonResponse(
  res: Response
): Promise<{ html?: string; error?: string }> {
  const text = await res.text();
  if (!text) {
    return { error: `Empty response (${res.status})` };
  }
  try {
    return JSON.parse(text) as { html?: string; error?: string };
  } catch {
    return {
      error:
        text.length > 180
          ? `${text.slice(0, 180)}…`
          : text || `Request failed (${res.status})`,
    };
  }
}

export function DesignElementChat({
  agentSpec,
  selection,
  onClearSelection,
  onSpecUpdate,
  disabled,
}: DesignElementChatProps) {
  const [instruction, setInstruction] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed || !selection || isApplying || disabled) return;

    const html = getAgentFrontendHtml(agentSpec);
    if (!html) {
      setError("No frontend HTML found. Generate a design first.");
      return;
    }

    setIsApplying(true);
    setError(null);
    setLastApplied(null);

    try {
      const res = await fetch("/api/design-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          selection,
          instruction: trimmed,
          agentName: agentSpec.name,
          agentRole: agentSpec.persona.role,
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok || !data.html) {
        throw new Error(data.error ?? "Failed to apply design change");
      }

      const current = agentSpec.deployment?.files ?? [];
      const other = current.filter((f) => f.path !== "index.html");
      const nextSpec = updateDeploymentFiles(
        agentSpec,
        [
          ...other,
          { path: "index.html", language: "html", content: data.html },
        ],
        { designInstruction: trimmed }
      );

      onSpecUpdate(nextSpec);
      setInstruction("");
      setLastApplied(`Updated "${selection.label}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <HudPanel
      tier={2}
      glow="cyan"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 border-t border-white/[0.06]"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.05] px-3 py-2">
        <MessageSquare className="size-3.5 text-system" strokeWidth={1.75} />
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Edit selection
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {selection ? (
          <div className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-system/25 bg-system/[0.05] px-3 py-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-system">
                <MousePointer2 className="size-3" />
                Selected
              </p>
              <p className="mt-0.5 truncate text-[12px] font-medium text-foreground">
                {selection.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {selection.tagName}
                {selection.text
                  ? ` · "${selection.text.slice(0, 60)}${selection.text.length > 60 ? "…" : ""}"`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-dashed border-white/[0.08] px-3 py-2.5">
            <MousePointer2 className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Click any element in the design above, then describe your change here
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-auto flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-system/60" />
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={!selection || isApplying || disabled}
              placeholder={
                selection
                  ? `e.g. "make it red and bolder"`
                  : "Select an element first…"
              }
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-system/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!selection || !instruction.trim() || isApplying || disabled}
            className="h-10 shrink-0 gap-1.5 border border-system/30 bg-system/10 px-3 text-system hover:bg-system/15"
          >
            {isApplying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Apply
          </Button>
        </form>

        {error && (
          <p className="mt-2 text-[11px] leading-relaxed text-red-400/90">{error}</p>
        )}
        {lastApplied && !error && (
          <p className="mt-2 text-[11px] text-system/80">{lastApplied}</p>
        )}
      </div>
    </HudPanel>
  );
}
