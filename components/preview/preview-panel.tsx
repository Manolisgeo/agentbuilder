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
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    const scrollContainer = anchor.closest(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement | null;
    if (!scrollContainer) return;

    const distanceFromBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    const shouldAutoScroll =
      messages.length <= 1 || distanceFromBottom < 120;

    if (shouldAutoScroll) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      });
    }
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
    <HudPanel
      tier={2}
      glow="violet"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      {/* Fake device-chrome header */}
      <div className="shrink-0 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] bg-black/20 px-4 py-2">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500/60" />
            <span className="size-2.5 rounded-full bg-yellow-500/60" />
            <span className="size-2.5 rounded-full bg-green-500/60" />
          </div>
          <div className="ml-2 flex flex-1 items-center justify-center">
            <div className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              <span className="size-1 rounded-full bg-violet" />
              swarm://preview/{agentSpec.name.toLowerCase().replace(/\s+/g, "-")}
            </div>
          </div>
        </div>

        <div
          className="relative overflow-hidden px-4 py-4"
          style={{
            background:
              "linear-gradient(135deg, rgba(139,92,246,0.16) 0%, rgba(139,92,246,0.02) 60%, transparent 100%)",
          }}
        >
          <div className="absolute -right-12 -top-12 size-32 rounded-full bg-violet/20 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-violet/30 blur-md" />
                <div className="relative flex size-10 items-center justify-center rounded-xl border border-violet/40 bg-gradient-to-br from-violet/30 to-violet/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                  <Bot className="size-5 text-violet-200" strokeWidth={1.75} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-semibold text-foreground">
                    {agentSpec.name}
                  </h2>
                  <span className="rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-violet-200">
                    Preview
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
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

          <p className="relative mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/85">
            <Sparkles className="size-3 text-violet-300/80" />
            Simulated end-user experience — not deployed yet
          </p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="space-y-5 py-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md space-y-5 pt-8 text-center">
              <div className="relative mx-auto flex size-16 items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-violet/20 blur-xl" />
                <div className="relative flex size-16 items-center justify-center rounded-2xl border border-violet/30 bg-gradient-to-br from-violet/20 to-violet/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Bot className="size-7 text-violet-200" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">
                  Try your agent before deploying
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
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
                    className="lift w-full rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5 text-left text-[12.5px] leading-relaxed text-muted-foreground transition-all hover:border-violet/30 hover:bg-violet/[0.06] hover:text-foreground disabled:opacity-40"
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

      <div className="border-t border-white/[0.05]">
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
