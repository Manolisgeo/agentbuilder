"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { AgentSpec } from "@/lib/agent-spec";
import type { SwarmUIMessage } from "@/lib/chat-types";

interface ChatPanelProps {
  agentSpec: AgentSpec;
  onSpecUpdate: (spec: AgentSpec) => void;
  onError: (message: string) => void;
}

export function ChatPanel({
  agentSpec,
  onSpecUpdate,
  onError,
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

  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="font-semibold">Build your agent</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Describe what you want — watch it assemble live.
        </p>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              Try: &ldquo;Build me a research assistant that searches the web
              and summarizes findings in a friendly tone.&rdquo;
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
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
                        className="text-xs italic opacity-80"
                      >
                        Updating agent spec…
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Building…
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error.message}
            </div>
          )}
        </div>
      </ScrollArea>

      <form
        className="border-t p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = input.trim();
          if (!trimmed || isBusy) return;
          sendMessage({ text: trimmed });
          setInput("");
        }}
      >
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe your agent…"
            rows={2}
            disabled={isBusy}
            className="min-h-[72px] resize-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={isBusy || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
