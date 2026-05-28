"use client";

import { Bot, User } from "lucide-react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallDisplay, SpecUpdateGroup, SPEC_TOOLS } from "@/components/chat/tool-call-display";
import type { PlanStepStatus } from "@/lib/chat-types";
import { sanitizeAssistantChatText } from "@/lib/chat-display";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
  planStepOverrides?: Record<string, PlanStepStatus>;
  assistantLabel?: string;
  workingLabel?: string;
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => (
    <p className="mb-2 text-[13.5px] leading-relaxed text-foreground/90 last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-[15px] font-semibold text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[14px] font-semibold text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2.5 text-[13.5px] font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 space-y-1 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 space-y-1 pl-4 text-[13.5px] leading-relaxed text-foreground/90 [counter-reset:list-item]">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    // Inside <ol> react-markdown sets ordered=true on the li node
    const isOrdered = (props as { ordered?: boolean }).ordered;
    if (isOrdered) {
      return (
        <li className="list-decimal text-[13.5px] leading-relaxed text-foreground/90 marker:text-primary/60">
          {children}
        </li>
      );
    }
    return (
      <li className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/90">
        <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/70" />
        <span className="min-w-0">{children}</span>
      </li>
    );
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block w-full overflow-x-auto rounded-lg border border-black/[0.07] bg-black/[0.04] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground/85 dark:border-white/[0.07] dark:bg-white/[0.04]">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-foreground/85 dark:bg-white/[0.07]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-lg border border-black/[0.07] bg-black/[0.04] p-0 dark:border-white/[0.07] dark:bg-white/[0.04]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-[13.5px] italic text-foreground/70">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  hr: () => (
    <hr className="my-3 border-black/[0.07] dark:border-white/[0.07]" />
  ),
  table: ({ children }) => (
    <div className="my-2.5 overflow-x-auto rounded-lg border border-black/[0.07] dark:border-white/[0.07]">
      <table className="w-full text-[12.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-black/[0.03] dark:bg-white/[0.03]">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-black/[0.07] px-3 py-2 text-left font-semibold text-foreground/90 dark:border-white/[0.07]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-black/[0.04] px-3 py-2 text-foreground/80 last:border-0 dark:border-white/[0.04]">
      {children}
    </td>
  ),
};

export function ChatMessage({
  message,
  isStreaming,
  planStepOverrides,
  assistantLabel = "Swarm",
  workingLabel = "Working",
}: ChatMessageProps) {
  const isUser = message.role === "user";

  const textParts = message.parts.filter((part) => part.type === "text");
  const SILENT_TOOLS = new Set([
    "clarifyUser", // shown as ClarifyCard
    "updatePlanStep", // reflected in plan card step status
    "readArchitecture", // internal read, no user-visible output
    "renderDashboard", // shown as DashboardCard in PreviewPanel
  ]);
  const allToolParts = message.parts.filter(
    (part) => isToolUIPart(part) && !SILENT_TOOLS.has(getToolName(part))
  );
  const specToolParts = allToolParts.filter(
    (part) => isToolUIPart(part) && SPEC_TOOLS.has(getToolName(part))
  );
  const toolParts = allToolParts.filter(
    (part) => isToolUIPart(part) && !SPEC_TOOLS.has(getToolName(part))
  );
  const rawTextContent = textParts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
  const textContent =
    !isUser && rawTextContent
      ? sanitizeAssistantChatText(rawTextContent)
      : rawTextContent;

  if (!textContent && toolParts.length === 0 && specToolParts.length === 0) return null;

  return (
    <div className="group flex gap-3">
      <div
        className={cn(
          "relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
          isUser
            ? "border-black/[0.08] bg-black/[0.03] text-foreground/70 dark:border-white/[0.08] dark:bg-white/[0.03]"
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
            {isUser ? "You" : assistantLabel}
          </span>
          {!isUser && isStreaming && (
            <span className="flex items-center gap-1">
              <span className="size-1 rounded-full bg-primary [animation:idle-pulse_1s_ease-in-out_infinite]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary/70">
                {workingLabel}
              </span>
            </span>
          )}
        </div>

        <div className="text-foreground/90">
          {textContent && (
            <div className="prose-none min-w-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={
                  isUser
                    ? {
                        p: ({ children }) => (
                          <p className="text-[13.5px] leading-relaxed text-foreground/90">
                            {children}
                          </p>
                        ),
                      }
                    : mdComponents
                }
              >
                {textContent}
              </ReactMarkdown>
              {isStreaming && !isUser && (
                <span
                  className="caret-blink ml-0.5 inline-block h-[14px] w-[2px] translate-y-0.5 bg-primary"
                  aria-hidden
                />
              )}
            </div>
          )}

          {specToolParts.length > 0 && (
            <SpecUpdateGroup
              parts={specToolParts
                .filter(isToolUIPart)
                .map((part) => ({
                  toolName: getToolName(part),
                  state: "state" in part ? String(part.state) : undefined,
                  input: "input" in part ? part.input : undefined,
                  output: part.state === "output-available" ? part.output : undefined,
                }))}
              isStreaming={isStreaming}
            />
          )}

          {toolParts.map((part) => {
            if (!isToolUIPart(part)) return null;
            const toolName = getToolName(part);
            return (
              <ToolCallDisplay
                key={part.toolCallId}
                toolName={toolName}
                state={"state" in part ? String(part.state) : undefined}
                input={"input" in part ? part.input : undefined}
                output={
                  part.state === "output-available" ? part.output : undefined
                }
                stepOverrides={planStepOverrides}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
