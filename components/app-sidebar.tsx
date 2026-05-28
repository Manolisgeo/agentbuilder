"use client";

import { Bot, Download, Layers, Sparkles } from "lucide-react";

const navItems = [
  { icon: Sparkles, label: "Builder", active: true },
  { icon: Bot, label: "Agents", active: false },
  { icon: Layers, label: "Workflows", active: false },
  { icon: Download, label: "Export", active: false },
];

export function AppSidebar() {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#0d0b0a] py-4">
      <div className="mb-6 flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-surface-1">
        <Sparkles className="size-4 text-primary" strokeWidth={1.5} />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            className={`group relative flex size-10 items-center justify-center rounded-lg transition-all duration-200 ${
              item.active
                ? "bg-surface-2 text-primary"
                : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
            }`}
          >
            {item.active && (
              <span className="absolute -left-px top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
            )}
            <item.icon className="size-4" strokeWidth={1.5} />
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded border border-white/[0.06] px-1.5 py-1">
        <p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
          Pro
        </p>
      </div>
    </aside>
  );
}
