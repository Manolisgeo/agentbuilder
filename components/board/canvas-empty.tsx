"use client";

import { Bot, BookOpen, Wrench } from "lucide-react";
import type { BuildPhase } from "@/lib/build-phase";

interface CanvasEmptyProps {
  buildPhase?: BuildPhase;
  buildProgress?: number;
}

export function CanvasEmpty({ buildPhase, buildProgress }: CanvasEmptyProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="relative flex flex-col items-center">
        {/* Concentric reticle */}
        <div className="relative flex size-[280px] items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-system/10 idle-pulse" />
          <div className="absolute inset-[14px] rounded-full border border-system/15 reticle-spin" />
          <div className="absolute inset-[32px] rounded-full border border-dashed border-white/[0.06] reticle-spin-reverse" />
          <div className="absolute inset-[50px] rounded-full bg-gradient-radial from-primary/8 via-transparent to-transparent" />

          {/* Schematic dots */}
          <svg
            width="220"
            height="220"
            viewBox="0 0 220 220"
            className="absolute"
            aria-hidden
          >
            <defs>
              <linearGradient id="schematic-edge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.5)" />
                <stop offset="100%" stopColor="rgba(59,130,246,0.4)" />
              </linearGradient>
              <linearGradient id="schematic-tool" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.5)" />
                <stop offset="100%" stopColor="rgba(16,185,129,0.4)" />
              </linearGradient>
            </defs>
            <path
              d="M 70 110 Q 110 90 150 70"
              stroke="url(#schematic-edge)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              fill="none"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-16"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </path>
            <path
              d="M 70 110 Q 110 130 150 150"
              stroke="url(#schematic-tool)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              fill="none"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-16"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </path>
          </svg>

          {/* 3 schematic nodes */}
          <div className="absolute left-[36px] top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg border border-violet/40 bg-gradient-to-br from-violet/30 to-violet/10 shadow-[0_0_16px_-4px_rgba(139,92,246,0.6)] backdrop-blur-sm">
            <Bot className="size-4 text-violet-200" strokeWidth={2} />
          </div>
          <div className="absolute right-[36px] top-[36px] flex size-9 items-center justify-center rounded-lg border border-blue-400/40 bg-gradient-to-br from-blue-500/30 to-blue-500/10 shadow-[0_0_16px_-4px_rgba(59,130,246,0.6)] backdrop-blur-sm">
            <BookOpen className="size-4 text-blue-200" strokeWidth={2} />
          </div>
          <div className="absolute right-[36px] bottom-[36px] flex size-9 items-center justify-center rounded-lg border border-emerald-400/40 bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 shadow-[0_0_16px_-4px_rgba(16,185,129,0.6)] backdrop-blur-sm">
            <Wrench className="size-4 text-emerald-200" strokeWidth={2} />
          </div>
        </div>

        {/* Caption */}
        <div className="mt-2 flex max-w-md flex-col items-center px-6 text-center">
          <p className="text-[14px] font-medium text-foreground">
            {buildPhase === "discovery"
              ? "Your workflow will appear here"
              : "Canvas ready for assembly"}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {buildPhase === "discovery"
              ? "Answer a few questions in chat, then start building — nodes will materialize and connect on this board."
              : "Describe your agent in chat — nodes will spawn and link as the spec is built."}
          </p>
          {buildProgress !== undefined && buildProgress > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1">
              <span className="size-1.5 rounded-full bg-system idle-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-system">
                {buildProgress}% configured
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
