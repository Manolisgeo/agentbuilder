"use client";

import { memo, useMemo, useEffect, useRef, useState } from "react";
import { getPreviewSrcDoc } from "@/lib/deploy-html";
import {
  FRONTEND_PLACEHOLDER_HTML,
  type FrontendFrameMode,
  type FrontendFrameOptions,
} from "@/lib/frontend-runtime";
import { cn } from "@/lib/utils";

const IFRAME_DEBOUNCE_MS = 350;

interface AgentFrontendFrameProps {
  html: string | null;
  mode: FrontendFrameMode;
  frameOptions?: FrontendFrameOptions;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  className?: string;
  title?: string;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(value), delayMs);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [value, delayMs]);

  return debounced;
}

export const AgentFrontendFrame = memo(function AgentFrontendFrame({
  html,
  mode,
  frameOptions,
  iframeRef,
  className,
  title,
}: AgentFrontendFrameProps) {
  // Debounce the html before building srcDoc so rapid spec updates (e.g.
  // multiple tool calls in a row) don't trigger multiple full iframe reloads.
  const debouncedHtml = useDebounced(html, IFRAME_DEBOUNCE_MS);

  const srcDoc = useMemo(
    () =>
      getPreviewSrcDoc(
        debouncedHtml?.trim() ? debouncedHtml : FRONTEND_PLACEHOLDER_HTML,
        mode,
        frameOptions
      ),
    [debouncedHtml, mode, frameOptions]
  );

  return (
    <div className={cn("min-h-0 flex-1 overflow-hidden bg-[#07060a]", className)}>
      <iframe
        ref={iframeRef}
        title={title ?? "Agent frontend"}
        srcDoc={srcDoc}
        className="h-full w-full border-0"
        sandbox={
          mode === "static"
            ? undefined
            : frameOptions?.voice
              ? "allow-scripts allow-same-origin"
              : "allow-scripts"
        }
        allow={
          mode !== "static" && frameOptions?.voice
            ? "microphone; autoplay"
            : undefined
        }
      />
    </div>
  );
});
