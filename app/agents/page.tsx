"use client";

import { useEffect, useState } from "react";
import { Bot, Clock, ExternalLink, Plus, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { deleteAgent, listAgents, type StoredAgent } from "@/lib/agent-storage";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function AgentCard({
  agent,
  onDelete,
}: {
  agent: StoredAgent;
  onDelete: (id: string) => void;
}) {
  const { spec } = agent;
  const toolCount = spec.tools.length;
  const subAgentCount = spec.agents?.length ?? 0;

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-black/[0.07] bg-gradient-to-b from-black/[0.02] to-transparent p-4 transition-all hover:border-black/[0.12] hover:from-black/[0.04] dark:border-white/[0.07] dark:from-white/[0.04] dark:hover:border-white/[0.12] dark:hover:from-white/[0.06]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] bg-primary/[0.12] dark:border-white/[0.08]">
            <Bot className="size-4 text-primary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {spec.name}
            </p>
            {spec.persona.role && (
              <p className="truncate text-[11px] text-muted-foreground">
                {spec.persona.role}
              </p>
            )}
          </div>
        </div>

        {/* Actions — visible on hover */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onDelete(agent.id)}
            className="flex size-7 items-center justify-center rounded-md border border-black/[0.07] bg-black/[0.03] text-muted-foreground transition-colors hover:border-red-500/30 hover:bg-red-500/[0.08] hover:text-red-500 dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:text-red-400"
            title="Delete agent"
          >
            <Trash2 className="size-3.5" />
          </button>
          <Link
            href={`/?id=${agent.id}`}
            className="flex size-7 items-center justify-center rounded-md border border-black/[0.07] bg-black/[0.03] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.08] hover:text-primary dark:border-white/[0.07] dark:bg-white/[0.03]"
            title="Open in builder"
          >
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Instructions preview */}
      {spec.instructions && (
        <p className="line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground/80">
          {spec.instructions}
        </p>
      )}

      {/* Footer chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {toolCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-black/[0.07] bg-black/[0.02] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground dark:border-white/[0.07] dark:bg-white/[0.02]">
            <Wrench className="size-2.5" />
            {toolCount} tool{toolCount !== 1 ? "s" : ""}
          </span>
        )}
        {subAgentCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary/70">
            <Bot className="size-2.5" />
            {subAgentCount} sub-agent{subAgentCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <Clock className="size-2.5" />
          {timeAgo(agent.updatedAt)}
        </span>
      </div>

      {/* Full-card open link */}
      <Link
        href={`/?id=${agent.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open ${spec.name} in builder`}
      />
      {/* Delete + open links sit above the card link */}
      <div className="pointer-events-none absolute inset-0" />
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAgents(listAgents());
    setLoaded(true);
  }, []);

  function handleDelete(id: string) {
    deleteAgent(id);
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <ErrorBoundary>
      <div className="hud-canvas flex h-screen overflow-hidden">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative shrink-0 border-b border-black/[0.06] bg-surface-1/80 px-6 py-5 backdrop-blur-md dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="hud-label mb-1">Library</p>
                <h1 className="text-lg font-medium tracking-tight text-foreground">
                  Your agents
                </h1>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary dark:border-white/[0.08] dark:bg-white/[0.03]"
              >
                <Plus className="size-3.5" strokeWidth={2} />
                New agent
              </Link>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-6">
            {!loaded ? null : agents.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl border border-black/[0.08] bg-gradient-to-br from-black/[0.03] to-transparent dark:border-white/[0.08] dark:from-white/[0.05]">
                    <Bot className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No agents yet
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Agents you build in the Builder will appear here once saved. Start by describing what you want your agent to do.
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-br from-[#ff8a3d] to-[#ff6b1a] px-4 text-sm font-medium text-black shadow-[0_4px_16px_-4px_rgba(255,107,26,0.55)] transition-shadow hover:shadow-[0_6px_22px_-4px_rgba(255,107,26,0.75)]"
                  >
                    <Plus className="size-3.5" strokeWidth={2.5} />
                    Build your first agent
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 text-xs text-muted-foreground">
                  {agents.length} agent{agents.length !== 1 ? "s" : ""} saved
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {agents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
