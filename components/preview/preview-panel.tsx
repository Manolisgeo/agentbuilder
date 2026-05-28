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
import { inferVoiceFromSpec } from "@/lib/voice";
import {
  createAudioRecorder,
  isValidRecording,
  startRecording,
  stopRecording,
} from "@/lib/voice-recording";
import { transcribePreviewAudio } from "@/lib/voice-client";
import {
  arrayBufferToBase64,
  fetchPreviewTtsAudio,
  resetSpokenTexts,
  shouldSpeakText,
} from "@/lib/voice-preview-tts";

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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef("audio/webm");
  const previewSendLockRef = useRef(false);
  const assistantPostRef = useRef("");
  agentSpecRef.current = agentSpec;
  onMemoryUpdateRef.current = onMemoryUpdate;

  const isSwarm = Boolean(agentSpec.agents?.length);
  const hasLiveSearch = hasWebSearchTool(agentSpec);
  const isVoice = inferVoiceFromSpec(agentSpec);
  const voiceAgentName = isVoice ? agentSpec.name : "";
  const voiceFrameOptions = useMemo(
    () => (isVoice ? { voice: true, agentName: voiceAgentName } : undefined),
    [isVoice, voiceAgentName]
  );
  const isVoicePreview = isVoice;

  const postToFrame = useCallback(
    (data: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(data, "*");
    },
    []
  );

  // Throttle streaming text updates to avoid flooding the iframe on every chunk.
  const streamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStreamRef = useRef<{ text: string; done: boolean } | null>(null);

  const cancelVoiceTts = useCallback(() => {
    postToFrame({ type: "agent-preview-tts-cancel" });
  }, [postToFrame]);

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
    const handler = async (event: MessageEvent) => {
      const d = event.data;
      if (!d || typeof d !== "object") return;

      if (d.type === "agent-preview-send") {
        const text = d.text;
        if (
          typeof text === "string" &&
          text.trim() &&
          !isBusy &&
          !previewSendLockRef.current
        ) {
          cancelVoiceTts();
          previewSendLockRef.current = true;
          sendMessage({ text: text.trim() });
        }
        return;
      }

      if (d.type === "agent-preview-record-start") {
        cancelVoiceTts();
        try {
          if (recorderRef.current?.state === "recording") return;
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          streamRef.current = stream;
          const { recorder, mimeType, getChunks } = createAudioRecorder(stream);
          mimeTypeRef.current = mimeType;
          recorderRef.current = recorder;
          recorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            recorderRef.current = null;
            await new Promise((r) => setTimeout(r, 80));
            try {
              const chunks = getChunks();
              const blob = new Blob(chunks, { type: mimeTypeRef.current });
              if (!isValidRecording(blob)) {
                postToFrame({
                  type: "agent-preview-stt-error",
                  message:
                    "Recording too short — tap Talk, speak for a second, then tap Stop.",
                });
                return;
              }
              const resp = await transcribePreviewAudio(
                blob,
                mimeTypeRef.current,
                agentSpecRef.current
              );
              if (resp.ok && resp.text) {
                postToFrame({ type: "agent-preview-stt-result", text: resp.text });
              } else {
                postToFrame({
                  type: "agent-preview-stt-error",
                  message: resp.error || "Could not transcribe audio.",
                });
              }
            } catch (err) {
              postToFrame({
                type: "agent-preview-stt-error",
                message:
                  err instanceof Error
                    ? err.message
                    : "Speech-to-text failed.",
              });
            }
          };
          startRecording(recorder);
        } catch {
          postToFrame({
            type: "agent-preview-record-error",
            message:
              "Microphone access denied — allow mic for localhost in your browser settings.",
          });
        }
        return;
      }

      if (d.type === "agent-preview-record-stop") {
        const rec = recorderRef.current;
        if (rec?.state === "recording") {
          await stopRecording(rec);
        } else {
          postToFrame({
            type: "agent-preview-stt-error",
            message: "No active recording — tap Talk and speak first.",
          });
        }
        return;
      }

      if (d.type === "agent-preview-stt-request" && typeof d.audio === "string") {
        try {
          const binary = atob(d.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "audio/webm" });
          const data = await transcribePreviewAudio(
            blob,
            "audio/webm",
            agentSpecRef.current
          );
          if (data.ok && data.text) {
            postToFrame({ type: "agent-preview-stt-result", text: data.text });
          } else {
            postToFrame({
              type: "agent-preview-stt-error",
              message: data.error || "Could not transcribe audio.",
            });
          }
        } catch {
          postToFrame({
            type: "agent-preview-stt-error",
            message: "Speech-to-text failed.",
          });
        }
        return;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendMessage, isBusy, postToFrame, cancelVoiceTts]);

  useEffect(() => {
    if (!isBusy) {
      previewSendLockRef.current = false;
    }
  }, [isBusy]);

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
      const postKey = `${lastMessage.id}:done:${text}`;
      if (assistantPostRef.current === postKey) return;
      assistantPostRef.current = postKey;
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

  // Speak each new assistant response once. Module-level dedup survives StrictMode remounts.
  useEffect(() => {
    if (!isVoicePreview) return;
    if (isBusy) return;
    if (lastMessage?.role !== "assistant") return;

    const text = getAssistantText(lastMessage).trim();
    if (!shouldSpeakText(text)) return;

    postToFrame({ type: "agent-preview-tts-pending" });

    void (async () => {
      try {
        const buffer = await fetchPreviewTtsAudio(text, agentSpecRef.current);
        postToFrame({
          type: "agent-preview-tts-audio",
          audio: arrayBufferToBase64(buffer),
        });
      } catch (err) {
        postToFrame({
          type: "agent-preview-tts-error",
          message:
            err instanceof Error ? err.message : "Text-to-speech failed.",
        });
      }
    })();
  }, [lastMessage, isBusy, isVoicePreview, postToFrame]);

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
    previewSendLockRef.current = false;
    assistantPostRef.current = "";
    resetSpokenTexts();
    cancelVoiceTts();
    postToFrame({ type: "agent-preview-reset" });
  }

  const statusLine = hasLiveSearch
    ? isSwarm
      ? "Live swarm — same UI as Design, with real tools"
      : "Live preview — same UI as Design, with web search"
    : voiceFrameOptions
      ? "Live voice preview — ElevenLabs mic + spoken replies"
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
        frameOptions={voiceFrameOptions}
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
