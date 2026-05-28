"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Check, Copy, Loader2, Sparkles, User, Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ClarifyCard } from "@/components/clarify-card";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildAnswerMessage, type ClarifyAnswer, type ClarifyBlock } from "@/lib/clarify-types";
import type { CodeSpec } from "@/lib/codegen-types";
import type { CodegenUIMessage } from "@/lib/chat-types";

interface CodegenChatPanelProps {
  codeSpec: CodeSpec;
  onSpecUpdate: (spec: CodeSpec) => void;
  onError: (message: string) => void;
  onBuildingChange?: (building: boolean) => void;
  onCodeUpdate?: (code: string) => void;
  onClarifyPendingChange?: (pending: boolean) => void;
}

const STARTER_PROMPTS = [
  "Read my Gmail every hour and email me a daily summary",
  "Monitor a URL for price changes and notify me via Slack",
  "Pull top HN posts every morning and send a digest email",
];

function extractPythonCode(text: string): string {
  const match = text.match(/```(?:python)?\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

function looksLikePython(text: string): boolean {
  return /\b(import|def |class |if __name__|os\.environ)\b/.test(text);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-surface-1/90 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-white/15 hover:text-foreground"
      aria-label="Copy code"
    >
      {copied ? (
        <>
          <Check className="size-3 text-green-400" />
          <span className="text-green-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="size-3" />
          Copy
        </>
      )}
    </button>
  );
}

function CodeBlock({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const code = extractPythonCode(text);
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-white/[0.08]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-surface-1/90 px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Python
        </span>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="flex items-center gap-1 font-mono text-[9px] text-system">
              <span className="size-1.5 animate-pulse rounded-full bg-system" />
              Generating
            </span>
          )}
          <CopyButton text={code} />
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto text-[12px]">
        <SyntaxHighlighter
          language="python"
          style={oneDark}
          customStyle={{
            margin: 0,
            background: "transparent",
            fontSize: "12px",
            lineHeight: "1.6",
          }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function ToolUpdatePart({ state }: { state?: string }) {
  const isDone = state === "output-available" || state === "output-error";
  return (
    <div
      className={`my-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
        isDone
          ? "border-primary/20 bg-primary/[0.06] text-primary/80"
          : "border-system/25 bg-system/[0.06] text-system"
      }`}
    >
      <Sparkles className={`size-3 ${!isDone ? "animate-pulse" : ""}`} aria-hidden />
      {isDone ? "Architecture updated" : "Updating architecture…"}
    </div>
  );
}

export function CodegenChatPanel({
  codeSpec,
  onSpecUpdate,
  onError,
  onBuildingChange,
  onCodeUpdate,
  onClarifyPendingChange,
}: CodegenChatPanelProps) {
  const [input, setInput] = useState("");
  const [clarifyBlock, setClarifyBlock] = useState<ClarifyBlock | null>(null);
  const [clarifySubmitted, setClarifySubmitted] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string | string[]>>({});
  const codeSpecRef = useRef(codeSpec);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  codeSpecRef.current = codeSpec;

  const { messages, sendMessage, status, error, stop } = useChat<CodegenUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/codegen",
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: { messages, id, codeSpec: codeSpecRef.current },
      }),
    }),
    onData: (dataPart) => {
      if (dataPart.type === "data-codeSpec") {
        onSpecUpdate(dataPart.data);
        // Code was generated — clarification cycle is complete
        setClarifyBlock(null);
      } else if (dataPart.type === "data-clarify") {
        setClarifyBlock(dataPart.data as unknown as ClarifyBlock);
        setClarifySubmitted(false);
        setSubmittedAnswers({});
      }
    },
    onError: (err) => {
      onError(err.message);
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);

  useEffect(() => {
    if (status === "ready" && lastMessage?.role === "assistant") {
      const textPart = lastMessage.parts.find((p) => p.type === "text");
      if (textPart && textPart.type === "text" && looksLikePython(textPart.text)) {
        onCodeUpdate?.(extractPythonCode(textPart.text));
      }
    }
  }, [status, lastMessage, onCodeUpdate]);

  const streamingAssistantId =
    isBusy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  useEffect(() => {
    onBuildingChange?.(isBusy);
  }, [isBusy, onBuildingChange]);

  // clarifyPending: card is visible and waiting for user input
  const clarifyPending = clarifyBlock !== null && !clarifySubmitted && !isBusy;

  useEffect(() => {
    onClarifyPendingChange?.(clarifyPending);
  }, [clarifyPending, onClarifyPendingChange]);

  function handleClarifySubmit(answers: ClarifyAnswer[]) {
    if (!clarifyBlock) return;
    const answerMap: Record<string, string | string[]> = {};
    for (const a of answers) answerMap[a.id] = a.answer;
    setSubmittedAnswers(answerMap);
    setClarifySubmitted(true);
    sendMessage({ text: buildAnswerMessage(clarifyBlock, answers) });
  }

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, clarifyBlock, isBusy]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setClarifyBlock(null);
    setClarifySubmitted(false);
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <HudPanel tier={1} className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="hud-label">Input channel</p>
          <h2 className="mt-0.5 text-sm font-medium">Script generator</h2>
        </div>
        {isBusy ? (
          <span className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/[0.06] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-primary">
            <Loader2 className="size-3 animate-spin" />
            Processing
          </span>
        ) : messages.length > 0 ? (
          <span className="rounded-md border border-system/25 bg-system/[0.06] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-system">
            Ready
          </span>
        ) : null}
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.06] bg-surface-2/40 px-4 py-4">
                <p className="text-sm font-medium text-foreground">
                  Describe your Python agent
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Tell me what you want the script to do — I&apos;ll design the
                  architecture and generate a complete, runnable Python script.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="hud-label px-1">Quick prompts</p>
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitPrompt(prompt)}
                    disabled={isBusy}
                    className="w-full rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2.5 text-left text-xs leading-relaxed text-muted-foreground transition-all duration-200 hover:border-primary/25 hover:bg-surface-2/50 hover:text-foreground disabled:opacity-40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const textParts = message.parts.filter((p) => p.type === "text");
            const toolParts = message.parts.filter((p) => p.type.startsWith("tool-"));
            const textContent = textParts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
              .trim();
            const isStreaming = message.id === streamingAssistantId;
            const isPythonCode = !isUser && looksLikePython(textContent);

            if (!textContent && toolParts.length === 0) return null;

            return (
              <div
                key={message.id}
                className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border ${
                    isUser
                      ? "border-white/[0.08] bg-surface-3 text-muted-foreground"
                      : "border-primary/20 bg-primary/[0.08] text-primary"
                  }`}
                >
                  {isUser ? (
                    <User className="size-3.5" aria-hidden />
                  ) : (
                    <Bot className="size-3.5" aria-hidden />
                  )}
                </div>

                <div
                  className={`min-w-0 flex-1 text-sm leading-relaxed ${
                    isUser ? "flex justify-end" : ""
                  }`}
                >
                  {toolParts.map((part, index) => (
                    <ToolUpdatePart
                      key={index}
                      state={"state" in part ? String(part.state) : undefined}
                    />
                  ))}

                  {textContent && (
                    isPythonCode ? (
                      <CodeBlock text={textContent} isStreaming={isStreaming} />
                    ) : (
                      <div
                        className={`inline-block rounded-xl px-3.5 py-2.5 text-left ${
                          isUser
                            ? "border border-white/[0.08] bg-surface-3 text-foreground"
                            : "border border-white/[0.05] bg-surface-2/80 text-foreground/95"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{textContent}</p>
                        {isStreaming && !isUser && (
                          <span className="ml-0.5 inline-block size-1.5 animate-pulse rounded-full bg-primary align-middle" />
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {/* ClarifyCard: driven by state alone — no dependency on message parts */}
          {clarifyBlock && (
            <ClarifyCard
              block={clarifyBlock}
              onSubmit={handleClarifySubmit}
              submitted={clarifySubmitted}
              submittedAnswers={submittedAnswers}
            />
          )}

          {error && <HudError message={error.message} />}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-white/[0.06]">
        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => submitPrompt(input)}
          onStop={stop}
          isBusy={isBusy || clarifyPending}
          placeholder={
            clarifyPending
              ? "Answer the questions above to continue…"
              : "Describe your agent script or refine the current one…"
          }
        />
      </div>
    </HudPanel>
  );
}
