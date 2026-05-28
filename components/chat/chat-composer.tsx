"use client";

import { ArrowUp, Square } from "lucide-react";
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
      <div className="rounded-xl border border-white/[0.08] bg-surface-1 shadow-hud-sm transition-colors focus-within:border-white/[0.12]">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={1}
          disabled={isBusy}
          className="block max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
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

        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
          <p className="pl-1 text-[10px] text-muted-foreground/60">
            Enter to send · Shift+Enter for newline
          </p>

          {isBusy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-surface-3 text-foreground transition-colors hover:border-white/20 hover:bg-surface-2"
            >
              <Square className="size-3 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full transition-all",
                canSend
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-surface-3 text-muted-foreground/40"
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
