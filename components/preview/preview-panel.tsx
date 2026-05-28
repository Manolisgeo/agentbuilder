"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { RotateCcw, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessage } from "@/components/chat/chat-message";
import { DeployShell, themedButtonStyle } from "@/components/preview/deploy-shell";
import { SwarmOrchestrationTimeline } from "@/components/preview/swarm-orchestration-timeline";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import {
  hasWebSearchTool,
  isAgentPreviewReady,
} from "@/lib/agent-prompt";
import { resolveAgentUi } from "@/lib/agent-ui";
import { dedupeMessagesById, getChatMessageKey } from "@/lib/chat-messages";
import type { AgentSpec } from "@/lib/agent-spec";
import type {
  OrchestrationStep,
  PreviewUIMessage,
} from "@/lib/preview-types";
import type { MemoryWriteEvent } from "@/lib/swarm-memory";

interface PreviewPanelProps {
  agentSpec: AgentSpec;
  onMemoryUpdate?: (event: MemoryWriteEvent) => void;
}

export function PreviewPanel({ agentSpec, onMemoryUpdate }: PreviewPanelProps) {
  const [input, setInput] = useState("");
  const [orchestrationSteps, setOrchestrationSteps] = useState<
    OrchestrationStep[]
  >([]);
  const agentSpecRef = useRef(agentSpec);
  const onMemoryUpdateRef = useRef(onMemoryUpdate);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  agentSpecRef.current = agentSpec;
  onMemoryUpdateRef.current = onMemoryUpdate;

  const ui = resolveAgentUi(agentSpec.ui);
  const isSwarm = Boolean(agentSpec.agents?.length);
  const hasLiveSearch = hasWebSearchTool(agentSpec);
  const isReady = isAgentPreviewReady(agentSpec);
  const starters = ui.starterPrompts ?? [];

  const { messages, sendMessage, status, error, stop, setMessages } =
    useChat<PreviewUIMessage>({
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
      onData: (dataPart) => {
        if (dataPart.type === "data-orchestration") {
          setOrchestrationSteps(dataPart.data.steps);
        }
        if (dataPart.type === "data-memoryState") {
          onMemoryUpdateRef.current?.(dataPart.data);
        }
        if (dataPart.type === "data-gmailAuthRequired") {
          window.location.href = dataPart.data.redirectUrl;
        }
      },
    });

  const isBusy = status === "submitted" || status === "streaming";
  const displayMessages = useMemo(
    () => dedupeMessagesById(messages),
    [messages]
  );
  const lastMessage = displayMessages.at(-1);
  const streamingAssistantId =
    isBusy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  useEffect(() => {
    if (status === "submitted") {
      setOrchestrationSteps([]);
    }
  }, [status]);

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
      displayMessages.length <= 1 || distanceFromBottom < 120;

    if (shouldAutoScroll) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [displayMessages, isBusy, orchestrationSteps]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy || !isReady) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  function resetConversation() {
    if (isBusy) stop();
    setMessages([]);
    setOrchestrationSteps([]);
    setInput("");
  }

  const statusLine = hasLiveSearch
    ? isSwarm
      ? "Live swarm run — real web search and visible agent coordination"
      : "Live run — web search executes against real sources"
    : "End-user preview with your configured deployment theme";

  return (
    <HudPanel
      tier={2}
      glow="violet"
      live={hasLiveSearch}
      className="flex h-full min-h-0 flex-col overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <DeployShell
          agentSpec={agentSpec}
          variant="preview"
          className="min-h-0 flex-1 rounded-none border-0"
          footer={
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: "var(--agent-muted)" }}
                >
                  {hasLiveSearch ? (
                    <Zap className="size-3" style={{ color: "var(--agent-accent)" }} />
                  ) : (
                    <Sparkles className="size-3" style={{ color: "var(--agent-accent)" }} />
                  )}
                  {statusLine}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetConversation}
                  disabled={displayMessages.length === 0 && !isBusy}
                  className="h-7 shrink-0 gap-1.5 text-xs"
                  style={{ color: "var(--agent-muted)" }}
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              </div>
              <ChatComposer
                value={input}
                onChange={setInput}
                onSubmit={() => submitPrompt(input)}
                onStop={stop}
                isBusy={isBusy}
                placeholder={
                  isReady
                    ? `Message ${agentSpec.name}…`
                    : "Complete the agent build to preview…"
                }
              />
            </div>
          }
        >
          <ScrollArea className="h-full min-h-[280px] px-4">
            <div className="space-y-5 py-4">
              {displayMessages.length === 0 && (
                <div className="mx-auto max-w-md space-y-5 pt-6 text-center">
                  <div>
                    <p
                      className="text-[14px] font-medium"
                      style={{ color: "var(--agent-text)" }}
                    >
                      {isReady
                        ? ui.welcomeMessage ?? "Run your agent with live tools"
                        : "Finish building to preview"}
                    </p>
                    <p
                      className="mt-1.5 text-[12px] leading-relaxed"
                      style={{ color: "var(--agent-muted)" }}
                    >
                      {isReady
                        ? hasLiveSearch
                          ? "Ask about current events — web search hits real sources."
                          : "Chat as an end user would with your themed interface."
                        : "Complete persona and instructions in the builder before previewing."}
                    </p>
                  </div>

                  {isReady && (
                    <div className="space-y-1.5 text-left">
                      {starters.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => submitPrompt(prompt)}
                          disabled={isBusy}
                          className="w-full px-3.5 py-2.5 text-left text-[12.5px] leading-relaxed transition-opacity hover:opacity-90 disabled:opacity-40"
                          style={themedButtonStyle()}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {displayMessages.map((message, index) => {
                const isLastAssistant =
                  message.role === "assistant" &&
                  index === displayMessages.length - 1;
                const showOrchestration =
                  isSwarm &&
                  isLastAssistant &&
                  orchestrationSteps.length > 0;

                return (
                  <div key={getChatMessageKey(message, index)}>
                    {showOrchestration && (
                      <SwarmOrchestrationTimeline
                        steps={orchestrationSteps}
                        isActive={isBusy}
                      />
                    )}
                    <ChatMessage
                      message={message}
                      isStreaming={message.id === streamingAssistantId}
                      assistantLabel={agentSpec.name}
                      workingLabel={
                        isSwarm && isBusy ? "Orchestrating" : "Responding"
                      }
                    />
                  </div>
                );
              })}

              {isBusy &&
                displayMessages.length > 0 &&
                displayMessages.at(-1)?.role === "user" &&
                orchestrationSteps.length > 0 && (
                  <SwarmOrchestrationTimeline
                    steps={orchestrationSteps}
                    isActive
                  />
                )}

              {error && <HudError message={error.message} />}
              <div ref={scrollAnchorRef} />
            </div>
          </ScrollArea>
        </DeployShell>
      </div>
    </HudPanel>
  );
}
