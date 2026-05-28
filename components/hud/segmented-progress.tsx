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
  segments = 12,
  statusLabel,
  className,
  compact = false,
}: SegmentedProgressProps) {
  const displayValue = useCountUp(value);
  const filledSegments = Math.round((value / 100) * segments);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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

      <div className="flex gap-[3px]">
        {Array.from({ length: segments }).map((_, index) => {
          const isFilled = index < filledSegments;
          const isEdge = index === filledSegments - 1 && filledSegments > 0;
          return (
            <div
              key={index}
              className={cn(
                "h-2 flex-1 rounded-[2px] transition-all duration-500 ease-out",
                isFilled
                  ? "bg-gradient-to-b from-[#ffb27a] to-[#ff6b1a] shadow-[0_0_10px_rgba(255,107,26,0.45)]"
                  : "bg-black/[0.07] dark:bg-white/[0.05]",
                isEdge && value > 0 && "animate-pulse-glow"
              )}
            />
          );
        })}
      </div>

      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-system/85">
        {statusLabel}
      </p>
    </div>
  );
}
