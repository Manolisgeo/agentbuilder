"use client";

import { MousePointer2, Palette } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentFrontendFrame } from "@/components/design/agent-frontend-frame";
import { DesignElementChat } from "@/components/design/design-element-chat";
import { ResizableDesignSplit } from "@/components/design/resizable-design-split";
import { HudPanel } from "@/components/hud/hud-panel";
import { hasAgentFrontend } from "@/lib/deploy-html";
import { getPlatformLabel } from "@/lib/agent-ui";
import type { AgentSpec } from "@/lib/agent-spec";
import {
  DESIGN_HIGHLIGHT_MESSAGE,
  DESIGN_SELECT_MESSAGE,
  type DesignSelection,
} from "@/lib/design-inspector";

interface DesignPreviewPanelProps {
  agentSpec: AgentSpec;
  onSpecUpdate?: (spec: AgentSpec) => void;
}

export function DesignPreviewPanel({
  agentSpec,
  onSpecUpdate,
}: DesignPreviewPanelProps) {
  const platform = agentSpec.deployment?.platform ?? "html";
  const hasFrontend = hasAgentFrontend(agentSpec);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selection, setSelection] = useState<DesignSelection | null>(null);

  const htmlContent = agentSpec.deployment?.files.find(
    (f) => f.path === "index.html"
  )?.content;

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type !== DESIGN_SELECT_MESSAGE) return;
    const sel = event.data.selection as DesignSelection | undefined;
    if (sel?.id) setSelection(sel);
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    setSelection(null);
  }, [htmlContent]);

  useEffect(() => {
    if (!selection?.id || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: DESIGN_HIGHLIGHT_MESSAGE, id: selection.id },
      "*"
    );
  }, [selection?.id, htmlContent]);

  const previewFrame = (
    <AgentFrontendFrame
      agentSpec={agentSpec}
      mode="design"
      iframeRef={iframeRef}
      title={`${agentSpec.name} design`}
      className="h-full"
    />
  );

  return (
    <HudPanel
      tier={2}
      glow="cyan"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Palette className="size-4 text-system" strokeWidth={1.75} />
          <div>
            <p className="hud-label leading-none">Design</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <MousePointer2 className="size-3" />
              {hasFrontend
                ? "Click to select · drag the divider to resize the edit panel"
                : "Ask the chat to generate your agent's UI"}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-system/30 bg-system/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-system">
          {getPlatformLabel(platform)}
        </span>
      </div>

      {onSpecUpdate && hasFrontend ? (
        <ResizableDesignSplit
          className="min-h-0 flex-1"
          top={previewFrame}
          bottom={
            <DesignElementChat
              agentSpec={agentSpec}
              selection={selection}
              onClearSelection={() => setSelection(null)}
              onSpecUpdate={onSpecUpdate}
            />
          }
        />
      ) : (
        previewFrame
      )}
    </HudPanel>
  );
}
