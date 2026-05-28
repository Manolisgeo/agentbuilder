"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import type { AgentSpec } from "@/lib/agent-spec";
import type { SwarmUIMessage } from "@/lib/chat-types";

interface ChatPanelProps {
  agentSpec: AgentSpec;
  onSpecUpdate: (spec: AgentSpec) => void;
  onError: (message: string) => void;
  onBuildingChange?: (building: boolean) => void;
}

const STARTER_PROMPTS = [
  "Build me a research assistant that searches the web and summarizes findings.",
  "Create a customer support agent with a professional, empathetic tone.",
  "I need an agent that monitors news and sends concise daily briefings.",
];

export function ChatPanel({
  agentSpec,
  onSpecUpdate,
  onError,
  onBuildingChange,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const agentSpecRef = useRef(agentSpec);
  agentSpecRef.current = agentSpec;

  const { messages, sendMessage, status, error } = useChat<SwarmUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: {
          messages,
          id,
          agentSpec: agentSpecRef.current,
        },
      }),
    }),
    onData: (dataPart) => {
      if (dataPart.type === "data-agentSpec") {
        onSpecUpdate(dataPart.data);
      }
    },
    onError: (err) => {
      onError(err.message);
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    onBuildingChange?.(isBusy);
  }, [isBusy, onBuildingChange]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <HudPanel tier={1} className="flex h-full min-h-[420px] flex-col">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="hud-label">Input channel</p>
        <h2 className="mt-0.5 text-sm font-medium">Agent builder</h2>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-3 py-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 px-3 py-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Describe what your agent should do. One clarifying question
                  max — then live assembly begins.
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
                    className="w-full rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground transition-all duration-200 hover:border-primary/25 hover:text-foreground disabled:opacity-40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "border border-white/[0.08] bg-surface-3 text-foreground"
                    : "border border-white/[0.06] bg-surface-2 text-foreground/90"
                }`}
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <p key={index}>{part.text}</p>;
                  }
                  if (part.type.startsWith("tool-")) {
                    return (
                      <p
                        key={index}
                        className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-system"
                      >
                        <span className="size-1 rounded-full bg-system idle-pulse" />
                        Updating spec
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="flex items-center gap-2 rounded-lg border border-system/20 bg-system/[0.04] px-3 py-2">
              <Loader2 className="size-3 animate-spin text-system" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-system">
                Processing
              </span>
            </div>
          )}

          {error && <HudError message={error.message} />}
        </div>
      </ScrollArea>

      <form
        className="border-t border-white/[0.06] p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submitPrompt(input);
        }}
      >
        <div className="relative">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe your agent…"
            rows={2}
            disabled={isBusy}
            className="min-h-[68px] resize-none border-white/[0.06] bg-surface-1 pr-11 text-sm focus-visible:border-primary/40 focus-visible:ring-primary/15"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isBusy || !input.trim()}
            className="absolute bottom-2 right-2 size-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </form>
    </HudPanel>
  );
}
