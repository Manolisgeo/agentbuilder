"use client";

import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

interface SegmentedProgressProps {
  value: number;
  statusLabel: string;
  className?: string;
  compact?: boolean;
}

export function SegmentedProgress({
  value,
  statusLabel,
  className,
  compact = false,
}: SegmentedProgressProps) {
  const displayValue = useCountUp(value);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[11px] font-medium text-muted-foreground">
          Build progress
        </p>
        <p
          className={cn(
            "font-mono font-semibold tabular-nums",
            compact ? "text-lg" : "text-3xl",
            value > 0 ? "text-gradient-ember" : "text-muted-foreground"
          )}
        >
          {displayValue}
          <span className="ml-0.5 text-base text-muted-foreground">%</span>
        </p>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#ffb27a] to-[#ff6b1a] transition-all duration-700 ease-out"
          style={{ width: `${value}%` }}
        />
        {value > 0 && value < 100 && (
          <div
            className="absolute top-0 h-full w-8 -translate-x-1/2 rounded-full bg-white/30 blur-sm animate-pulse"
            style={{ left: `${value}%` }}
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/80">
        {statusLabel}
      </p>
    </div>
  );
}
