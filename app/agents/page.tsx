"use client";

import { Bot, Plus } from "lucide-react";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";

export default function AgentsPage() {
  return (
    <ErrorBoundary>
      <div className="hud-canvas flex h-screen overflow-hidden">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative shrink-0 border-b border-white/[0.06] bg-surface-1/80 px-6 py-5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="hud-label mb-1">Library</p>
                <h1 className="text-lg font-medium tracking-tight text-foreground">
                  Your agents
                </h1>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary"
              >
                <Plus className="size-3.5" strokeWidth={2} />
                New agent
              </Link>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent">
                <Bot className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  No agents yet
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Agents you build in the Builder will appear here. Start by describing what you want your agent to do.
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
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
