"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Play, RotateCcw, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentFrontendFrame } from "@/components/design/agent-frontend-frame";
import { ArticlesFeed } from "@/components/preview/articles-feed";
import { DashboardCard } from "@/components/preview/dashboard-card";
import { SwarmOrchestrationTimeline } from "@/components/preview/swarm-orchestration-timeline";
import { Button } from "@/components/ui/button";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import { useAgentFrontendHtml } from "@/hooks/use-agent-frontend-html";
import { useDeferredHtml } from "@/hooks/use-deferred-html";
import { hasWebSearchTool } from "@/lib/agent-prompt";
import type { AgentSpec } from "@/lib/agent-spec";
import { dedupeMessagesById } from "@/lib/chat-messages";
import type {
  ArticlesFeedData,
  DashboardData,
  OrchestrationStep,
  PreviewUIMessage,
} from "@/lib/preview-types";
import type { MemoryWriteEvent } from "@/lib/swarm-memory";

interface PreviewPanelProps {
  agentSpec: AgentSpec;
  onMemoryUpdate?: (event: MemoryWriteEvent) => void;
  isActive?: boolean;
}

function getAssistantText(message: PreviewUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function PreviewPanel({
  agentSpec,
  onMemoryUpdate,
  isActive = true,
}: PreviewPanelProps) {
  const frontendHtml = useAgentFrontendHtml(agentSpec);
  const displayHtml = useDeferredHtml(frontendHtml, isActive);
  const [orchestrationSteps, setOrchestrationSteps] = useState<OrchestrationStep[]>([]);
  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
  const [articleFeeds, setArticleFeeds] = useState<ArticlesFeedData[]>([]);
  const agentSpecRef = useRef(agentSpec);
  const onMemoryUpdateRef = useRef(onMemoryUpdate);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  agentSpecRef.current = agentSpec;
  onMemoryUpdateRef.current = onMemoryUpdate;

  const isSwarm = Boolean(agentSpec.agents?.length);
  const hasLiveSearch = hasWebSearchTool(agentSpec);

  const postToFrame = useCallback(
    (data: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(data, "*");
    },
    []
  );

  // Throttle streaming text updates to avoid flooding the iframe on every chunk.
  const streamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStreamRef = useRef<{ text: string; done: boolean } | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/preview",
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: {
            messages,
            id,
            agentSpec: agentSpecRef.current,
          },
        }),
      }),
    []
  );

  const { messages, sendMessage, status, error, stop, setMessages } =
    useChat<PreviewUIMessage>({
      transport,
      onData: (dataPart) => {
        if (dataPart.type === "data-orchestration") {
          setOrchestrationSteps(dataPart.data.steps);
        }
        if (dataPart.type === "data-memoryState") {
          onMemoryUpdateRef.current?.(dataPart.data);
        }
        if (dataPart.type === "data-gmailAuthRequired") {
          // Save the spec first so the OAuth route can read credentials from
          // .agent-spec.json — credentials live in spec.envVars and the auth
          // route has no other way to access them without a saved file.
          fetch("/api/save-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(agentSpecRef.current),
          }).finally(() => {
            window.location.href = dataPart.data.redirectUrl;
          });
        }
        if (dataPart.type === "data-dashboard") {
          setDashboards((prev) => [...prev, dataPart.data]);
        }
        if (dataPart.type === "data-articlesFeed") {
          setArticleFeeds((prev) => [...prev, dataPart.data]);
        }
      },
    });

  const isBusy = status === "submitted" || status === "streaming";
  const displayMessages = dedupeMessagesById(messages);
  const lastMessage = displayMessages.at(-1);

  useEffect(() => {
    if (status === "submitted") {
      setOrchestrationSteps([]);
      setDashboards([]);
      setArticleFeeds([]);
    }
  }, [status]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "agent-preview-send") return;
      const text = event.data.text;
      if (typeof text === "string" && text.trim() && !isBusy) {
        sendMessage({ text: text.trim() });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendMessage, isBusy]);

  useEffect(() => {
    if (lastMessage?.role !== "assistant") return;
    const text = getAssistantText(lastMessage);
    const done = !isBusy;

    // Always send immediately when the stream is done so the iframe sees the
    // final complete text. During streaming, throttle to ~100ms to avoid
    // flooding the iframe with postMessage on every token.
    if (done) {
      if (streamThrottleRef.current !== null) {
        clearTimeout(streamThrottleRef.current);
        streamThrottleRef.current = null;
      }
      pendingStreamRef.current = null;
      postToFrame({ type: "agent-preview-assistant", text, done: true });
      return;
    }

    pendingStreamRef.current = { text, done };
    if (streamThrottleRef.current === null) {
      streamThrottleRef.current = setTimeout(() => {
        streamThrottleRef.current = null;
        const pending = pendingStreamRef.current;
        if (pending) {
          pendingStreamRef.current = null;
          postToFrame({ type: "agent-preview-assistant", ...pending });
        }
      }, 100);
    }
  }, [lastMessage, isBusy, postToFrame]);

  useEffect(() => {
    if (error) {
      postToFrame({
        type: "agent-preview-error",
        message: error.message,
      });
    }
  }, [error, postToFrame]);

  function resetConversation() {
    if (isBusy) stop();
    setMessages([]);
    setOrchestrationSteps([]);
    setDashboards([]);
    setArticleFeeds([]);
    postToFrame({ type: "agent-preview-reset" });
  }

  const statusLine = hasLiveSearch
    ? isSwarm
      ? "Live swarm — same UI as Design, with real tools"
      : "Live preview — same UI as Design, with web search"
    : "Live preview — identical to the Design tab";

  return (
    <HudPanel
      tier={2}
      glow="violet"
      live={hasLiveSearch}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Play className="size-4 text-violet-300" strokeWidth={1.75} />
          <div>
            <p className="hud-label leading-none">Preview</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              {hasLiveSearch && (
                <Zap className="size-3 text-violet-300/80" strokeWidth={1.75} />
              )}
              {statusLine}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetConversation}
          disabled={displayMessages.length === 0 && !isBusy}
          className="h-7 shrink-0 gap-1.5 text-xs text-muted-foreground"
        >
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      {isSwarm && orchestrationSteps.length > 0 && (
        <div className="shrink-0 border-b border-white/[0.05] px-4 py-2">
          <SwarmOrchestrationTimeline steps={orchestrationSteps} isActive={isBusy} />
        </div>
      )}

      {articleFeeds.length > 0 && (
        <div className="shrink-0 overflow-y-auto border-b border-white/[0.05]" style={{ maxHeight: "60%" }}>
          {articleFeeds.map((feed) => (
            <ArticlesFeed key={feed.id} feed={feed} />
          ))}
        </div>
      )}

      {dashboards.length > 0 && (
        <div className="shrink-0 space-y-0 overflow-y-auto border-b border-white/[0.05] px-4 py-2" style={{ maxHeight: "50%" }}>
          {dashboards.map((dashboard) => (
            <DashboardCard
              key={dashboard.id}
              id={dashboard.id}
              title={dashboard.title}
              html={dashboard.html}
            />
          ))}
        </div>
      )}

      <AgentFrontendFrame
        html={displayHtml}
        mode="live"
        iframeRef={iframeRef}
        title={`${agentSpec.name} preview`}
      />

      {error && (
        <div className="shrink-0 border-t border-white/[0.05] p-3">
          <HudError message={error.message} />
        </div>
      )}
    </HudPanel>
  );
}
