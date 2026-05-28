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
        "relative flex items-start gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5",
        variant === "amber"
          ? "border-primary/30 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]"
          : "border-system/30 bg-gradient-to-br from-system/[0.08] to-system/[0.02]",
        className
      )}
    >
      <div
        className={cn(
          "absolute -right-8 -top-8 size-20 rounded-full blur-2xl",
          variant === "amber" ? "bg-primary/20" : "bg-system/20"
        )}
      />
      <div
        className={cn(
          "relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md",
          variant === "amber"
            ? "bg-primary/15 text-primary"
            : "bg-system/15 text-system"
        )}
      >
        <AlertTriangle className="size-3" strokeWidth={2.2} />
      </div>
      <div className="relative">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          System alert
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-foreground/90">
          {message}
        </p>
      </div>
    </div>
  );
}
