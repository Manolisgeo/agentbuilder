import { cn } from "@/lib/utils";

type HudTier = 1 | 2 | 3;

const tierStyles: Record<HudTier, string> = {
  1: "bg-surface-1 shadow-hud-sm",
  2: "bg-surface-2 shadow-hud-md",
  3: "bg-surface-3 shadow-hud-lg",
};

interface HudPanelProps {
  children: React.ReactNode;
  className?: string;
  tier?: HudTier;
  live?: boolean;
}

export function HudPanel({
  children,
  className,
  tier = 2,
  live = false,
}: HudPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.06] ring-1 ring-inset ring-white/[0.03]",
        tierStyles[tier],
        live && "hud-brackets",
        className
      )}
    >
      {children}
    </div>
  );
}
