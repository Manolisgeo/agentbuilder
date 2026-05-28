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
    <aside className="relative z-10 flex w-16 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-5 shadow-[1px_0_0_rgba(255,255,255,0.7),4px_0_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:shadow-none">
      {/* Brand mark */}
      <div className="relative mb-7">
        <div className="relative flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path d="M12 2l2.5 6L21 9.5l-5 4.5 1.5 7L12 17.5 6.5 21 8 14l-5-4.5L9.5 8 12 2z" />
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
                <span className="absolute -left-px top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-primary" />
              )}

              <item.icon
                className="relative size-[18px] transition-transform group-hover:scale-110"
                strokeWidth={isActive ? 2 : 1.6}
              />

              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-sm transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
                {item.label}
              </span>
            </>
          );

          const baseClass = cn(
            "group relative flex size-10 items-center justify-center rounded-xl transition-all duration-200",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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

      {/* Bottom: settings */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          title="Settings"
          className="group flex size-10 items-center justify-center rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <Settings className="size-[18px]" strokeWidth={1.6} />
        </button>
      </div>
    </aside>
  );
}
