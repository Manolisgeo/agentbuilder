"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Hammer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessage } from "@/components/chat/chat-message";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import type { AgentSpec } from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { SwarmUIMessage } from "@/lib/chat-types";

interface ChatPanelProps {
  agentSpec: AgentSpec;
  buildPhase: BuildPhase;
  onBuildPhaseChange: (phase: BuildPhase) => void;
  onSpecUpdate: (spec: AgentSpec) => void;
  onError: (message: string) => void;
  onBuildingChange?: (building: boolean) => void;
}

const STARTER_PROMPTS = [
  "Build me a research assistant that searches the web and summarizes findings.",
  "Create a customer support agent with a professional, empathetic tone.",
  "I need an agent that monitors news and sends concise daily briefings.",
];

function looksLikeBuildIntent(text: string): boolean {
  return /\b(build it|start building|go ahead|let'?s build|ready to build|assemble the agent|begin building)\b/i.test(
    text
  );
}

export function ChatPanel({
  agentSpec,
  buildPhase,
  onBuildPhaseChange,
  onSpecUpdate,
  onError,
  onBuildingChange,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const agentSpecRef = useRef(agentSpec);
  const buildPhaseRef = useRef(buildPhase);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  agentSpecRef.current = agentSpec;
  buildPhaseRef.current = buildPhase;

  const { messages, sendMessage, status, error, stop } = useChat<SwarmUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: {
          messages,
          id,
          agentSpec: agentSpecRef.current,
          buildPhase: buildPhaseRef.current,
        },
      }),
    }),
    onData: (dataPart) => {
      if (
        dataPart.type === "data-agentSpec" &&
        buildPhaseRef.current === "building"
      ) {
        onSpecUpdate(dataPart.data);
      }
    },
    onError: (err) => {
      onError(err.message);
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const isDiscovery = buildPhase === "discovery";
  const lastMessage = messages.at(-1);
  const streamingAssistantId =
    isBusy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  useEffect(() => {
    onBuildingChange?.(isBusy && buildPhaseRef.current === "building");
  }, [isBusy, buildPhase, onBuildingChange]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;

    if (
      buildPhaseRef.current === "discovery" &&
      looksLikeBuildIntent(trimmed)
    ) {
      onBuildPhaseChange("building");
      buildPhaseRef.current = "building";
    }

    sendMessage({ text: trimmed });
    setInput("");
  }

  function startBuilding() {
    if (isBusy) return;
    onBuildPhaseChange("building");
    buildPhaseRef.current = "building";
    sendMessage({
      text: "I'm ready — please build the agent based on our conversation.",
    });
  }

  return (
    <HudPanel tier={1} className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="hud-label">Input channel</p>
          <h2 className="mt-0.5 text-sm font-medium">Agent builder</h2>
        </div>
        {isDiscovery ? (
          <span className="rounded-md border border-system/25 bg-system/[0.06] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-system">
            Discovery
          </span>
        ) : (
          <span className="rounded-md border border-primary/25 bg-primary/[0.06] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-primary">
            Building
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.06] bg-surface-2/40 px-4 py-4">
                <p className="text-sm font-medium text-foreground">
                  Let&apos;s design your agent together
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  I&apos;ll ask a few questions about purpose, tone, and
                  capabilities before assembling anything. When we&apos;re aligned,
                  hit <span className="text-foreground/80">Start building</span>.
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

      {isDiscovery && messages.length > 0 && !isBusy && (
        <div className="border-t border-white/[0.06] px-3 py-2.5">
          <Button
            type="button"
            onClick={startBuilding}
            className="h-8 w-full gap-2 bg-primary/90 text-primary-foreground hover:bg-primary"
          >
            <Hammer className="size-3.5" aria-hidden />
            Start building
          </Button>
        </div>
      )}

      <div className="border-t border-white/[0.06]">
        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => submitPrompt(input)}
          onStop={stop}
          isBusy={isBusy}
          placeholder={
            isDiscovery
              ? "Describe your agent or answer a question…"
              : "Refine the agent spec…"
          }
        />
      </div>
    </HudPanel>
  );
}
