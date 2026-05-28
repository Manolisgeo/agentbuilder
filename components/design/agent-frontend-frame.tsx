"use client";

import { useMemo } from "react";
import { getPreviewHtml } from "@/lib/deploy-html";
import type { AgentSpec } from "@/lib/agent-spec";
import type { FrontendFrameMode } from "@/lib/frontend-runtime";
import { cn } from "@/lib/utils";

interface AgentFrontendFrameProps {
  agentSpec: AgentSpec;
  mode: FrontendFrameMode;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  className?: string;
  title?: string;
}

export function AgentFrontendFrame({
  agentSpec,
  mode,
  iframeRef,
  className,
  title,
}: AgentFrontendFrameProps) {
  const srcDoc = useMemo(
    () => getPreviewHtml(agentSpec, { mode }),
    [agentSpec, mode]
  );

  return (
    <div className={cn("min-h-0 flex-1 overflow-hidden bg-[#07060a]", className)}>
      <iframe
        ref={iframeRef}
        title={title ?? `${agentSpec.name} frontend`}
        srcDoc={srcDoc}
        className="h-full w-full border-0"
        sandbox={mode === "static" ? "" : "allow-scripts"}
      />
    </div>
  );
}
