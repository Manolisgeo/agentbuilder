"use client";

import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

interface SegmentedProgressProps {
  value: number;
  segments?: number;
  statusLabel: string;
  className?: string;
  compact?: boolean;
}

export function SegmentedProgress({
  value,
  segments = 10,
  statusLabel,
  className,
  compact = false,
}: SegmentedProgressProps) {
  const displayValue = useCountUp(value);
  const filledSegments = Math.round((value / 100) * segments);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-end justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Build progress
        </p>
        <p
          className={cn(
            "font-mono font-semibold tabular-nums text-primary",
            compact ? "text-lg" : "text-2xl"
          )}
        >
          {displayValue}
          <span className="text-sm text-muted-foreground">%</span>
        </p>
      </div>

      <div className="flex gap-[3px]">
        {Array.from({ length: segments }).map((_, index) => {
          const isFilled = index < filledSegments;
          const isEdge = index === filledSegments - 1 && filledSegments > 0;
          return (
            <div
              key={index}
              className={cn(
                "h-2 flex-1 rounded-[2px] transition-all duration-300 ease-out",
                isFilled
                  ? "bg-primary shadow-[0_0_8px_rgba(255,107,26,0.35)]"
                  : "bg-white/[0.04]",
                isEdge && value > 0 && "animate-pulse-glow"
              )}
            />
          );
        })}
      </div>

      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-system/80">
        {statusLabel}
      </p>
    </div>
  );
}
