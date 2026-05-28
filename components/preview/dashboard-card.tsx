"use client";

import { LayoutDashboard, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

interface DashboardCardProps {
  id: string;
  title: string;
  html: string;
  onRefresh?: () => void;
}

export function DashboardCard({ id, title, html, onRefresh }: DashboardCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);

  function handleLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body) {
        const scrollH = doc.documentElement.scrollHeight || doc.body.scrollHeight;
        if (scrollH > 80) setHeight(Math.min(scrollH + 24, 720));
      }
    } catch {
      // cross-origin guard — height stays at default
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-3.5 shrink-0 text-primary/70" />
          <span className="text-[12px] font-medium text-foreground/90">{title}</span>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Re-run to refresh this dashboard"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
        )}
      </div>
      <iframe
        key={id}
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-scripts"
        title={title}
        onLoad={handleLoad}
        className="w-full border-0 bg-white"
        style={{ height }}
      />
    </div>
  );
}
