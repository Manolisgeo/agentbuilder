"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  Hammer,
  Headphones,
  Mail,
  Mic,
  Newspaper,
  Search,
  Square,
  X,
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
import { isBuildComplete } from "@/lib/build-checklist";

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
    icon: Mic,
    label: "Voice agent",
    text: "Build a voice call agent with ElevenLabs — users speak via mic and hear spoken replies.",
    accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
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
  const [busySince, setBusySince] = useState<number | null>(null);
  const [stuckWarning, setStuckWarning] = useState(false);
  const [buildIncomplete, setBuildIncomplete] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
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

  // Track when a build-phase run starts and warn if stuck > 45 s
  useEffect(() => {
    if (isBusy && buildPhaseRef.current === "building") {
      if (busySince === null) setBusySince(Date.now());
    } else {
      setBusySince(null);
      setStuckWarning(false);
    }
  }, [isBusy, busySince]);

  useEffect(() => {
    if (isBusy) {
      setBuildIncomplete(false);
      return;
    }
    if (buildPhase === "building" && displayMessages.length > 0) {
      setBuildIncomplete(!isBuildComplete(agentSpec));
    }
  }, [isBusy, buildPhase, agentSpec, displayMessages.length]);

  useEffect(() => {
    if (busySince === null) return;
    const id = setInterval(() => {
      if (Date.now() - busySince > 45_000) {
        setStuckWarning(true);
        clearInterval(id);
      }
    }, 2_000);
    return () => clearInterval(id);
  }, [busySince]);

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
      setPlanStepOverrides({});
      onBuildPhaseChange("building");
      buildPhaseRef.current = "building";
    }

    sendMessage({ text: trimmed });
    setInput("");
  }

  function startBuilding() {
    if (isBusy) return;
    setPlanStepOverrides({});
    setBuildIncomplete(false);
    onBuildPhaseChange("building");
    buildPhaseRef.current = "building";
    sendMessage({
      text: "Start building now. Execute the full build checklist in order using tools only — persona, instructions, tools, enableVoice if this is a voice agent, then frontend. Mark plan steps complete only as you finish each one. Do not stop or summarize until every required checklist item is done.",
    });
  }

  function continueBuilding() {
    if (isBusy) return;
    sendMessage({
      text: "Continue the build from where you left off. Check the build checklist and call the remaining tools until all required items are complete.",
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
                : "bg-success/70 shadow-[0_0_6px_rgba(16,185,129,0.5)] idle-pulse"
            }`}
          />
          <h2 className="text-sm font-semibold text-foreground">Chat</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDebugOpen(true)}
            className="rounded p-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground/80"
            title="Debug — raw conversation &amp; logs"
          >
            <Bug className="size-3" />
          </button>
          {isDiscovery ? (
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              Planning
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1 text-[11px] text-primary">
              <span className="size-1 rounded-full bg-primary [animation:idle-pulse_1.4s_ease-in-out_infinite]" />
              Building
            </span>
          )}
        </div>
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
                <p className="px-1 text-xs font-semibold text-foreground/50 uppercase tracking-wide">Quick starts</p>
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
                        <p className="text-[11px] font-medium text-muted-foreground/70">
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

          {buildIncomplete && !isBusy && !error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-3">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-amber-300">
                  Build finished but agent is incomplete
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-300/70">
                  Some required steps were skipped (persona, instructions, or frontend). Click continue to finish the build.
                </p>
              </div>
              <button
                type="button"
                onClick={continueBuilding}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
              >
                Continue
              </button>
            </div>
          )}

          {stuckWarning && !error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-3">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-amber-300">
                  Build is taking longer than expected
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-300/70">
                  A tool call may have timed out silently. You can stop and retry, or wait a bit longer.
                </p>
              </div>
              <button
                type="button"
                onClick={stop}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
              >
                <Square className="size-3 fill-current" />
                Stop
              </button>
            </div>
          )}

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
              : "Refine your agent, add tools, or change how it works…"
          }
        />
      </div>
    </HudPanel>

    {clarifyBlock && (
      <ClarifyModal block={clarifyBlock} onSubmit={handleClarifySubmit} />
    )}

    {debugOpen && (
      <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setDebugOpen(false)}
        />
        <div className="relative flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0f] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bug className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Debug — raw conversation
              </span>
              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/60">
                {messages.length} msg · phase: {buildPhase} · status: {status}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDebugOpen(false)}
              className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground/50">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`font-mono text-[9px] uppercase tracking-[0.14em] ${
                          msg.role === "user"
                            ? "text-system"
                            : msg.role === "assistant"
                              ? "text-primary"
                              : "text-violet-400"
                        }`}
                      >
                        {msg.role}
                      </span>
                      {msg.id && (
                        <span className="font-mono text-[9px] text-muted-foreground/40">
                          {msg.id}
                        </span>
                      )}
                    </div>
                    <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-foreground/70">
                      {JSON.stringify(msg, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && (
            <div className="border-t border-red-500/20 bg-red-500/[0.05] px-4 py-3">
              <p className="font-mono text-[10px] text-red-400">
                <span className="text-red-500/60">error: </span>{error.message}
              </p>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
