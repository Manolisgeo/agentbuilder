"use client";

import { Bot } from "lucide-react";

export function IdleReticle() {
  return (
    <div className="relative flex size-28 items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-system/10 idle-pulse" />
      <div className="absolute inset-2 rounded-full border border-system/15 reticle-spin" />
      <div className="absolute inset-5 rounded-full border border-dashed border-white/[0.06]" />
      <div className="relative flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-surface-2 shadow-hud-md">
        <Bot className="size-6 text-muted-foreground" strokeWidth={1.5} />
        <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-system idle-pulse" />
      </div>
      <div className="scan-sweep pointer-events-none absolute inset-0 overflow-hidden rounded-full" />
    </div>
  );
}
