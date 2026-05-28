import { cn } from "@/lib/utils";

type HudTier = 1 | 2 | 3;

const tierStyles: Record<HudTier, string> = {
  1: "glass-panel",
  2: "glass-panel",
  3: "glass-panel-elevated",
};

interface HudPanelProps {
  children: React.ReactNode;
  className?: string;
  tier?: HudTier;
  live?: boolean;
  glow?: "none" | "ember" | "cyan" | "violet";
}

const glowStyles = {
  none: "",
  ember: "shadow-glow-ember",
  cyan: "shadow-glow-cyan",
  violet: "shadow-glow-violet",
} as const;

export function HudPanel({
  children,
  className,
  tier = 2,
  live = false,
  glow = "none",
}: HudPanelProps) {
  return (
    <div
      className={cn(
        "top-highlight relative overflow-hidden rounded-2xl",
        tierStyles[tier],
        live && "hud-brackets",
        glow !== "none" &&
          glow === "ember" &&
          "[box-shadow:var(--shadow-hud-md),var(--shadow-glow-ember)]",
        glow === "cyan" &&
          "[box-shadow:var(--shadow-hud-md),var(--shadow-glow-cyan)]",
        glow === "violet" &&
          "[box-shadow:var(--shadow-hud-md),var(--shadow-glow-violet)]",
        className
      )}
    >
      {children}
    </div>
  );
}
