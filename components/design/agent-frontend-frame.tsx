"use client";

import { memo, useMemo } from "react";
import { getPreviewSrcDoc } from "@/lib/deploy-html";
import { FRONTEND_PLACEHOLDER_HTML } from "@/lib/frontend-runtime";
import type { FrontendFrameMode } from "@/lib/frontend-runtime";
import { cn } from "@/lib/utils";

interface AgentFrontendFrameProps {
  html: string | null;
  mode: FrontendFrameMode;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  className?: string;
  title?: string;
}

export const AgentFrontendFrame = memo(function AgentFrontendFrame({
  html,
  mode,
  iframeRef,
  className,
  title,
}: AgentFrontendFrameProps) {
  const srcDoc = useMemo(
    () => getPreviewSrcDoc(html?.trim() ? html : FRONTEND_PLACEHOLDER_HTML, mode),
    [html, mode]
  );

  return (
    <div className={cn("min-h-0 flex-1 overflow-hidden bg-[#07060a]", className)}>
      <iframe
        ref={iframeRef}
        title={title ?? "Agent frontend"}
        srcDoc={srcDoc}
        className="h-full w-full border-0"
        sandbox={mode === "static" ? "" : "allow-scripts"}
      />
    </div>
  );
});
