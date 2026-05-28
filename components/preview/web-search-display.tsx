"use client";

import { ChevronDown, ExternalLink, Globe, Search } from "lucide-react";
import { useState } from "react";
import type { WebSearchResult } from "@/lib/preview-types";
import { cn } from "@/lib/utils";

interface WebSearchDisplayProps {
  result: WebSearchResult;
  isActive?: boolean;
  compact?: boolean;
}

export function WebSearchDisplay({
  result,
  isActive = false,
  compact = false,
}: WebSearchDisplayProps) {
  const [expanded, setExpanded] = useState(!compact && !isActive);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-system/[0.03]",
        isActive ? "border-system/35" : "border-system/20"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.02]"
      >
        <Globe className="size-3.5 shrink-0 text-system" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-foreground/90">
            {isActive ? "Searching the web…" : "Web search"}
          </p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {result.query}
          </p>
        </div>
        {!isActive && result.sources.length > 0 && (
          <span className="shrink-0 rounded-full border border-system/25 bg-system/[0.08] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-system">
            {result.sources.length} sources
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/[0.05] px-3 py-3">
          {result.answer && (
            <p className="text-[12.5px] leading-relaxed text-foreground/85">
              {result.answer}
            </p>
          )}

          {result.sources.length > 0 ? (
            <ul className="space-y-2">
              {result.sources.map((source) => (
                <li
                  key={source.url}
                  className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-2"
                >
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-1.5 text-[12px] font-medium text-system hover:text-system/80"
                  >
                    <span className="line-clamp-1">{source.title}</span>
                    <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                  </a>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                    {source.snippet}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              No sources returned for this query.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface WebSearchToolOutputProps {
  output: unknown;
  isDone: boolean;
  queryHint?: string;
}

export function WebSearchToolOutput({
  output,
  isDone,
  queryHint,
}: WebSearchToolOutputProps) {
  if (!isDone) {
    return (
      <div className="my-2.5 flex items-center gap-2 overflow-hidden rounded-lg border border-system/30 bg-system/[0.06] px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-system">
        <Search className="size-3.5 shrink-0" />
        <span>Searching the web{queryHint ? ` · ${queryHint}` : "…"}</span>
        <span className="ml-auto inline-flex gap-0.5">
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_infinite]" />
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.2s_infinite]" />
          <span className="size-1 rounded-full bg-system/60 [animation:idle-pulse_1.2s_ease-in-out_0.4s_infinite]" />
        </span>
      </div>
    );
  }

  if (!output || typeof output !== "object") return null;

  const payload = output as {
    query?: string;
    sources?: WebSearchResult["sources"];
    answer?: string | null;
    error?: string;
  };

  if (payload.error) {
    return (
      <div className="my-2.5 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-[12px] text-destructive/90">
        Web search unavailable: {payload.error}
      </div>
    );
  }

  return (
    <div className="my-2.5">
      <WebSearchDisplay
        result={{
          query: payload.query ?? queryHint ?? "Web search",
          sources: payload.sources ?? [],
          answer: payload.answer ?? undefined,
        }}
      />
    </div>
  );
}
