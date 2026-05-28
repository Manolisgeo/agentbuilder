import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HudErrorProps {
  message: string;
  variant?: "amber" | "cyan";
  className?: string;
}

export function HudError({
  message,
  variant = "amber",
  className,
}: HudErrorProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2",
        variant === "amber"
          ? "border-primary/30 bg-primary/[0.06]"
          : "border-system/30 bg-system/[0.06]",
        className
      )}
    >
      <AlertTriangle
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          variant === "amber" ? "text-primary" : "text-system"
        )}
      />
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          System alert
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">
          {message}
        </p>
      </div>
    </div>
  );
}
