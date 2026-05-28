"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessage } from "@/components/chat/chat-message";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import type { AgentSpec } from "@/lib/agent-spec";

interface PreviewPanelProps {
  agentSpec: AgentSpec;
}

const DEFAULT_STARTERS = [
  "Hi! What can you help me with?",
  "Walk me through an example of how you'd assist me.",
];

export function PreviewPanel({ agentSpec }: PreviewPanelProps) {
  const [input, setInput] = useState("");
  const agentSpecRef = useRef(agentSpec);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  agentSpecRef.current = agentSpec;

  const { messages, sendMessage, status, error, stop, setMessages } =
    useChat<UIMessage>({
      transport: new DefaultChatTransport({
        api: "/api/preview",
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: {
            messages,
            id,
            agentSpec: agentSpecRef.current,
          },
        }),
      }),
    });

  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const streamingAssistantId =
    isBusy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  function resetConversation() {
    if (isBusy) stop();
    setMessages([]);
    setInput("");
  }

  return (
    <HudPanel tier={2} className="flex h-full min-h-[420px] flex-col overflow-hidden">
      <div
        className="shrink-0 border-b border-white/[0.06] px-4 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.04) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/15">
              <Bot className="size-5 text-violet-300" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {agentSpec.name}
                </h2>
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-300">
                  Preview
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {agentSpec.persona.role}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetConversation}
            disabled={messages.length === 0 && !isBusy}
            className="h-7 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Reset
          </Button>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Sparkles className="size-3 text-violet-400/70" />
          Simulated end-user experience — not deployed yet
        </p>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md space-y-4 pt-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-surface-2">
                <Bot className="size-7 text-violet-400/80" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Try your agent before deploying
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Chat as an end user would. Responses use your persona and
                  instructions — tools run in simulated mode.
                </p>
              </div>

              <div className="space-y-1.5 text-left">
                {DEFAULT_STARTERS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitPrompt(prompt)}
                    disabled={isBusy}
                    className="w-full rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2.5 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:border-violet-500/25 hover:bg-surface-2/60 hover:text-foreground disabled:opacity-40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={message.id === streamingAssistantId}
            />
          ))}

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
          isBusy={isBusy}
          placeholder={`Message ${agentSpec.name}…`}
        />
      </div>
    </HudPanel>
  );
}
