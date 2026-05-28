"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Download, Layers, Settings, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Sparkles, label: "Builder", href: "/" },
  { icon: Bot, label: "Agents", href: "/agents" },
  { icon: Layers, label: "Workflows", href: null },
  { icon: Download, label: "Export", href: null },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="header-glow-in relative z-10 flex w-16 shrink-0 flex-col items-center border-r border-white/[0.05] bg-gradient-to-b from-[#0d0b0a]/95 to-[#06050a]/95 py-5 backdrop-blur-xl">
      {/* Brand mark */}
      <div className="relative mb-7">
        <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md" />
        <div className="relative flex size-10 items-center justify-center rounded-xl border border-white/[0.1] bg-gradient-to-br from-[#1a1816] to-[#0d0b0a] shadow-[0_4px_16px_rgba(255,107,26,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <defs>
              <linearGradient id="brand-grad" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stopColor="#ffb27a" />
                <stop offset="55%" stopColor="#ff6b1a" />
                <stop offset="100%" stopColor="#c2410c" />
              </linearGradient>
            </defs>
            <path
              d="M12 2l2.5 6L21 9.5l-5 4.5 1.5 7L12 17.5 6.5 21 8 14l-5-4.5L9.5 8 12 2z"
              fill="url(#brand-grad)"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {navItems.map((item) => {
          const isActive = item.href !== null && pathname === item.href;

          const inner = (
            <>
              {/* Active rail */}
              {isActive && (
                <span className="absolute -left-px top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-gradient-to-b from-transparent via-primary to-transparent shadow-[0_0_8px_rgba(255,107,26,0.8)]" />
              )}

              {/* Hover halo */}
              <span
                className={cn(
                  "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300",
                  !isActive && "group-hover:opacity-100"
                )}
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(255,107,26,0.12), transparent 70%)",
                }}
              />

              <item.icon
                className="relative size-[18px] transition-transform group-hover:scale-110"
                strokeWidth={isActive ? 2 : 1.6}
              />

              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/[0.08] bg-[#1a1816]/95 px-2 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-hud-sm backdrop-blur-md transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
                {item.label}
              </span>
            </>
          );

          const baseClass = cn(
            "group relative flex size-10 items-center justify-center rounded-xl transition-all duration-200",
            isActive
              ? "bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_16px_rgba(255,107,26,0.18)]"
              : "text-muted-foreground/80 hover:bg-white/[0.04] hover:text-foreground"
          );

          if (item.href === null) {
            return (
              <button key={item.label} type="button" title={item.label} className={baseClass}>
                {inner}
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href} title={item.label} className={baseClass}>
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: settings + avatar */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          title="Settings"
          className="group flex size-10 items-center justify-center rounded-xl text-muted-foreground/80 transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <Settings className="size-[18px]" strokeWidth={1.6} />
        </button>
        <div className="relative">
          <div className="flex size-9 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-violet/30 to-primary/20 text-[11px] font-medium text-foreground">
            <User className="size-4" strokeWidth={2} />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#0d0b0a] bg-success shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
        </div>
      </div>
    </aside>
  );
}
