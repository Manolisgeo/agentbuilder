"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowRight,
  Hammer,
  Headphones,
  Mail,
  Newspaper,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessage } from "@/components/chat/chat-message";
import { ClarifyModal } from "@/components/clarify-modal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import type { AgentSpec } from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import { buildAnswerMessage, type ClarifyAnswer, type ClarifyBlock } from "@/lib/clarify-types";
import type { PlanStepStatus, SwarmUIMessage } from "@/lib/chat-types";
import { getChatMessageKey, isMissingToolResultError, sanitizeChatMessages } from "@/lib/chat-messages";

interface ChatPanelProps {
  agentSpec: AgentSpec;
  buildPhase: BuildPhase;
  onBuildPhaseChange: (phase: BuildPhase) => void;
  onSpecUpdate: (spec: AgentSpec) => void;
  onError: (message: string) => void;
  onBuildingChange?: (building: boolean) => void;
}

const STARTER_PROMPTS = [
  {
    icon: Mail,
    label: "Gmail digest",
    text: "Build a Gmail Hourly Summary Agent that reads my unread emails, summarizes them with priority tags, and sends a digest to my inbox.",
    accent: "from-primary/20 to-primary/5 text-primary",
  },
  {
    icon: Search,
    label: "Research assistant",
    text: "Build me a research assistant that searches the web and summarizes findings.",
    accent: "from-system/20 to-system/5 text-system",
  },
  {
    icon: Headphones,
    label: "Customer support",
    text: "Create a customer support agent with a professional, empathetic tone.",
    accent: "from-violet/20 to-violet/5 text-violet-300",
  },
  {
    icon: Newspaper,
    label: "Daily briefings",
    text: "I need an agent that monitors news and sends concise daily briefings.",
    accent: "from-primary/20 to-primary/5 text-primary",
  },
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
  const [planStepOverrides, setPlanStepOverrides] = useState<
    Record<string, PlanStepStatus>
  >({});
  const [clarifyBlock, setClarifyBlock] = useState<ClarifyBlock | null>(null);
  const [clarifySubmitted, setClarifySubmitted] = useState(false);
  const agentSpecRef = useRef(agentSpec);
  const buildPhaseRef = useRef(buildPhase);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  agentSpecRef.current = agentSpec;
  buildPhaseRef.current = buildPhase;

  const { messages, sendMessage, status, error, stop, setMessages } = useChat<SwarmUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: {
          messages: sanitizeChatMessages(messages),
          id,
          agentSpec: agentSpecRef.current,
          buildPhase: buildPhaseRef.current,
        },
      }),
    }),
    onData: (dataPart) => {
      if (dataPart.type === "data-agentSpec") {
        onSpecUpdate(dataPart.data);
      }
      if (dataPart.type === "data-planStep") {
        setPlanStepOverrides((prev) => ({
          ...prev,
          [dataPart.data.stepId]: dataPart.data.status,
        }));
      }
      if (dataPart.type === "data-clarify") {
        // Only accept the first block per turn — never overwrite an unanswered one.
        setClarifyBlock((current) =>
          current === null ? (dataPart.data as unknown as ClarifyBlock) : current
        );
        setClarifySubmitted(false);
      }
    },
    onError: (err) => {
      if (isMissingToolResultError(err.message)) {
        setMessages((current) => sanitizeChatMessages(current));
      }
      onError(err.message);
    },
  });

  useEffect(() => {
    if (!error || !isMissingToolResultError(error.message)) return;
    setMessages((current) => sanitizeChatMessages(current));
  }, [error, setMessages]);

  const isBusy = status === "submitted" || status === "streaming";
  const isDiscovery = buildPhase === "discovery";
  const displayMessages = useMemo(
    () => sanitizeChatMessages(messages),
    [messages]
  );
  const lastMessage = displayMessages.at(-1);
  const streamingAssistantId =
    isBusy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  useEffect(() => {
    onBuildingChange?.(isBusy && buildPhaseRef.current === "building");
  }, [isBusy, buildPhase, onBuildingChange]);

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
  }, [displayMessages, isBusy]);

  const clarifyPending = clarifyBlock !== null && !clarifySubmitted && !isBusy;

  function handleClarifySubmit(answers: ClarifyAnswer[]) {
    if (!clarifyBlock) return;
    const text = buildAnswerMessage(clarifyBlock, answers);
    setClarifyBlock(null);
    setClarifySubmitted(false);
    sendMessage({ text });
  }

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;

    setClarifyBlock(null);
    setClarifySubmitted(false);

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
    <>
    <HudPanel tier={1} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3.5 dark:border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-1.5 rounded-full ${
              isBusy
                ? "bg-primary shadow-[0_0_8px_rgba(255,107,26,0.8)]"
                : "bg-system shadow-[0_0_6px_rgba(34,211,238,0.6)] idle-pulse"
            }`}
          />
          <div>
            <p className="hud-label leading-none">Conversation</p>
            <h2 className="mt-1 text-[13px] font-medium leading-none text-foreground">
              Builder
            </h2>
          </div>
        </div>

        {isDiscovery ? (
          <span className="flex items-center gap-1.5 rounded-full border border-system/25 bg-system/[0.06] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-system">
            <span className="size-1 rounded-full bg-system" />
            Discovery
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
            <span className="size-1 rounded-full bg-primary [animation:idle-pulse_1.4s_ease-in-out_infinite]" />
            Building
          </span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3">
        <div className="space-y-5 py-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="inner-card relative overflow-hidden px-4 py-4">
                <div className="absolute -right-12 -top-12 size-32 rounded-full bg-primary/10 blur-2xl" />
                <p className="relative text-[14px] font-medium text-foreground">
                  Let&apos;s design your agent together
                </p>
                <p className="relative mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  I can research topics, create a build plan, and assemble your
                  agent architecture — no need to keep saying &ldquo;continue.&rdquo;
                </p>
              </div>

              <div className="space-y-2">
                <p className="hud-label px-1">Quick starts</p>
                <div className="space-y-1.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.text}
                      type="button"
                      onClick={() => submitPrompt(prompt.text)}
                      disabled={isBusy}
                      className="group lift inner-card flex w-full items-start gap-3 px-3 py-2.5 text-left transition-all hover:brightness-[0.97] disabled:opacity-40"
                    >
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-gradient-to-br ${prompt.accent} shadow-[inset_0_1px_0_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`}
                      >
                        <prompt.icon className="size-3.5" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/80">
                          {prompt.label}
                        </p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/85 group-hover:text-foreground">
                          {prompt.text}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {displayMessages.map((message, index) => (
            <ChatMessage
              key={getChatMessageKey(message, index)}
              message={message}
              isStreaming={message.id === streamingAssistantId}
              planStepOverrides={planStepOverrides}
            />
          ))}

          {/* ClarifyModal is rendered via portal over the full page */}

          {error && <HudError message={error.message} />}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      {isDiscovery && messages.length > 0 && !isBusy && (
        <div className="border-t border-black/[0.06] px-3 py-2.5 dark:border-white/[0.05]">
          <Button
            type="button"
            onClick={startBuilding}
            className="lift h-9 w-full gap-2 bg-gradient-to-br from-[#ff8a3d] to-[#ff6b1a] text-primary-foreground shadow-[0_4px_16px_-4px_rgba(255,107,26,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_6px_22px_-4px_rgba(255,107,26,0.75),inset_0_1px_0_rgba(255,255,255,0.25)]"
          >
            <Hammer className="size-3.5" aria-hidden />
            Start building
          </Button>
        </div>
      )}

      <div className="border-t border-black/[0.06] dark:border-white/[0.05]">
        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => submitPrompt(input)}
          onStop={stop}
          isBusy={isBusy || clarifyPending}
          placeholder={
            isDiscovery
              ? "Describe your agent, ask for research, or request a plan…"
              : "Refine nodes, add tools, or restructure the architecture…"
          }
        />
      </div>
    </HudPanel>

    {clarifyBlock && (
      <ClarifyModal block={clarifyBlock} onSubmit={handleClarifySubmit} />
    )}
    </>
  );
}
