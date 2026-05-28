"use client";

import { Bot, Sparkles, User } from "lucide-react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

function formatText(text: string) {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  return paragraphs.map((paragraph, index) => {
    const lines = paragraph.split("\n");
    const isList = lines.every((line) => /^[-*•]\s/.test(line.trim()));

    if (isList) {
      return (
        <ul key={index} className="my-2 space-y-1 pl-1">
          {lines.map((line, lineIndex) => (
            <li
              key={lineIndex}
              className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/90"
            >
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/70" />
              <span>{line.replace(/^[-*•]\s*/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p
        key={index}
        className={cn(
          "text-[13.5px] leading-relaxed text-foreground/90",
          index > 0 && "mt-3"
        )}
      >
        {paragraph}
      </p>
    );
  });
}

function ToolUpdatePart({ state }: { state?: string }) {
  const isDone = state === "output-available" || state === "output-error";

  return (
    <div
      className={cn(
        "my-2.5 flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]",
        isDone
          ? "border-primary/25 bg-primary/[0.06] text-primary/85"
          : "border-system/30 bg-system/[0.06] text-system"
      )}
    >
      <span
        className={cn(
          "relative flex size-1.5 shrink-0 items-center justify-center",
          !isDone && "before:absolute before:inset-0 before:rounded-full before:bg-system/40 before:animate-ping"
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            isDone ? "bg-primary" : "bg-system"
          )}
        />
      </span>
      <Sparkles className="size-3 opacity-70" aria-hidden />
      <span>{isDone ? "Spec updated" : "Updating agent spec"}</span>
      {!isDone && (
        <span className="ml-auto inline-flex gap-0.5">
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_infinite]" />
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.2s_infinite]" />
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.4s_infinite]" />
        </span>
      )}
    </div>
  );
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  const textParts = message.parts.filter((part) => part.type === "text");
  const toolParts = message.parts.filter((part) => part.type.startsWith("tool-"));
  const textContent = textParts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

  if (!textContent && toolParts.length === 0) return null;

  return (
    <div className="group flex gap-3">
      <div
        className={cn(
          "relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
          isUser
            ? "border-white/[0.08] bg-white/[0.03] text-foreground/70"
            : "border-primary/30 bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-[0_0_12px_-2px_rgba(255,107,26,0.45)]"
        )}
      >
        {isUser ? (
          <User className="size-3.5" strokeWidth={1.8} aria-hidden />
        ) : (
          <Bot className="size-3.5" strokeWidth={2} aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.16em]",
              isUser ? "text-muted-foreground/80" : "text-primary/85"
            )}
          >
            {isUser ? "You" : "Swarm"}
          </span>
          {!isUser && isStreaming && (
            <span className="flex items-center gap-1">
              <span className="size-1 rounded-full bg-primary [animation:idle-pulse_1s_ease-in-out_infinite]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary/70">
                Streaming
              </span>
            </span>
          )}
        </div>

        <div className="text-foreground/90">
          {textContent && (
            <div className="whitespace-pre-wrap">
              {formatText(textContent)}
              {isStreaming && !isUser && (
                <span
                  className="caret-blink ml-0.5 inline-block h-[14px] w-[2px] translate-y-0.5 bg-primary"
                  aria-hidden
                />
              )}
            </div>
          )}

          {toolParts.map((part, index) => (
            <ToolUpdatePart
              key={index}
              state={"state" in part ? String(part.state) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
