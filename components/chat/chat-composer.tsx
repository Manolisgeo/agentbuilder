"use client";

import { ArrowUp, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
  placeholder?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
  placeholder = "Ask a follow-up…",
}: ChatComposerProps) {
  const canSend = value.trim().length > 0 && !isBusy;

  return (
    <form
      className="shrink-0 p-3 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <div
        className={cn(
          "group relative rounded-2xl border bg-gradient-to-b from-white/[0.04] to-white/[0.015] transition-all duration-200",
          "border-white/[0.07] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "focus-within:border-primary/40 focus-within:shadow-[0_0_0_1px_rgba(255,107,26,0.35),0_8px_32px_-8px_rgba(255,107,26,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
        )}
      >
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isBusy ? "Type your next message while Swarm works…" : placeholder}
          rows={1}
          className="block max-h-40 min-h-[48px] w-full resize-none bg-transparent px-4 py-3.5 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          onInput={(event) => {
            const target = event.currentTarget;
            target.style.height = "auto";
            target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
          }}
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
          <div className="flex items-center gap-2 pl-1">
            <Sparkles className="size-3 text-primary/60" aria-hidden />
            <span className="text-[10px] text-muted-foreground/70">
              {isBusy ? (
                <>Send when Swarm finishes</>
              ) : (
                <>
                  <kbd>Enter</kbd>
                  <span className="mx-1">to send</span>
                  <kbd>⇧</kbd>
                  <kbd>↵</kbd>
                  <span className="ml-1">for newline</span>
                </>
              )}
            </span>
          </div>

          {isBusy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="lift flex size-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-foreground transition-colors hover:border-white/20 hover:bg-white/[0.08]"
            >
              <Square className="size-3 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                "lift flex size-8 shrink-0 items-center justify-center rounded-full transition-all",
                canSend
                  ? "bg-gradient-to-br from-[#ff8a3d] to-[#ff6b1a] text-primary-foreground shadow-[0_4px_16px_-4px_rgba(255,107,26,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_6px_22px_-4px_rgba(255,107,26,0.9),inset_0_1px_0_rgba(255,255,255,0.3)]"
                  : "cursor-not-allowed bg-white/[0.04] text-muted-foreground/40"
              )}
            >
              <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
