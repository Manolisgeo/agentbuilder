"use client";

import { cn } from "@/lib/utils";

interface ProgressRailProps {
  value: number;
  className?: string;
}

export function ProgressRail({ value, className }: ProgressRailProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("progress-rail", className)} aria-hidden>
      <div
        className="progress-rail__fill progress-rail-glow"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
