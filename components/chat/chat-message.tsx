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
        <ul key={index} className="my-2 list-disc space-y-1 pl-4">
          {lines.map((line, lineIndex) => (
            <li key={lineIndex}>{line.replace(/^[-*•]\s*/, "")}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={index} className={index > 0 ? "mt-3" : undefined}>
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
        "my-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider",
        isDone
          ? "border-primary/20 bg-primary/[0.06] text-primary/80"
          : "border-system/25 bg-system/[0.06] text-system"
      )}
    >
      <Sparkles
        className={cn("size-3", !isDone && "animate-pulse")}
        aria-hidden
      />
      {isDone ? "Spec updated" : "Updating agent spec…"}
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
    <div
      className={cn(
        "group flex gap-2.5",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border",
          isUser
            ? "border-white/[0.08] bg-surface-3 text-muted-foreground"
            : "border-primary/20 bg-primary/[0.08] text-primary"
        )}
      >
        {isUser ? (
          <User className="size-3.5" aria-hidden />
        ) : (
          <Bot className="size-3.5" aria-hidden />
        )}
      </div>

      <div
        className={cn(
          "min-w-0 max-w-[85%] text-sm leading-relaxed",
          isUser ? "text-right" : "text-left"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-xl px-3.5 py-2.5 text-left",
            isUser
              ? "border border-white/[0.08] bg-surface-3 text-foreground"
              : "border border-white/[0.05] bg-surface-2/80 text-foreground/95"
          )}
        >
          {textContent ? (
            <div className="whitespace-pre-wrap">{formatText(textContent)}</div>
          ) : null}

          {toolParts.map((part, index) => (
            <ToolUpdatePart
              key={index}
              state={"state" in part ? String(part.state) : undefined}
            />
          ))}

          {isStreaming && !isUser && (
            <span className="ml-0.5 inline-block size-1.5 animate-pulse rounded-full bg-primary align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
