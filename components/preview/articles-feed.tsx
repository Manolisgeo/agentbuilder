"use client";

import { Clock, ExternalLink, Globe, Newspaper, ChevronDown } from "lucide-react";
import { useState, useCallback } from "react";
import type { ArticleData, ArticlesFeedData } from "@/lib/preview-types";

// Category → accent color mapping (uses Tailwind arbitrary values for the dark theme)
const CATEGORY_PALETTE: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  politics: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/25", gradient: "from-blue-900/60 to-blue-950/80" },
  world: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/25", gradient: "from-amber-900/60 to-amber-950/80" },
  tech: { bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-500/25", gradient: "from-violet-900/60 to-violet-950/80" },
  technology: { bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-500/25", gradient: "from-violet-900/60 to-violet-950/80" },
  business: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/25", gradient: "from-emerald-900/60 to-emerald-950/80" },
  economy: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/25", gradient: "from-emerald-900/60 to-emerald-950/80" },
  science: { bg: "bg-cyan-500/10", text: "text-cyan-300", border: "border-cyan-500/25", gradient: "from-cyan-900/60 to-cyan-950/80" },
  health: { bg: "bg-rose-500/10", text: "text-rose-300", border: "border-rose-500/25", gradient: "from-rose-900/60 to-rose-950/80" },
  sports: { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/25", gradient: "from-orange-900/60 to-orange-950/80" },
  default: { bg: "bg-primary/10", text: "text-primary/80", border: "border-primary/25", gradient: "from-zinc-800/60 to-zinc-900/80" },
};

function getCategoryStyle(category?: string) {
  if (!category) return CATEGORY_PALETTE.default;
  const key = category.toLowerCase().trim();
  return CATEGORY_PALETTE[key] ?? CATEGORY_PALETTE.default;
}

function formatRelativeTime(publishedAt?: string): string {
  if (!publishedAt) return "";
  try {
    const date = new Date(publishedAt);
    if (isNaN(date.getTime())) return publishedAt;
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return publishedAt;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// --- Hero Card (first article, full width, horizontal layout) ---
function HeroArticleCard({ article }: { article: ArticleData }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const style = getCategoryStyle(article.category);
  const relTime = formatRelativeTime(article.publishedAt);

  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]">
      <div className="flex min-h-[160px]">
        {/* Image column */}
        <div className="relative hidden w-52 shrink-0 overflow-hidden sm:block">
          {article.imageUrl && !imgError ? (
            <img
              src={article.imageUrl}
              alt=""
              onError={() => setImgError(true)}
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity duration-300 group-hover:opacity-95"
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-70`} />
          )}
          {/* Gradient fade right */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0d0d0f]" />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {article.category && (
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style.bg} ${style.text}`}>
                  {article.category}
                </span>
              )}
              <span className="text-[11px] font-medium text-muted-foreground/70">{article.source}</span>
              {relTime && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                  <Clock className="size-2.5" />
                  {relTime}
                </span>
              )}
            </div>

            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link block"
            >
              <h2 className="text-[15px] font-semibold leading-snug text-foreground/90 transition-colors duration-150 group-hover/link:text-foreground">
                {article.title}
                <ExternalLink className="ml-1.5 inline size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-60" />
              </h2>
            </a>

            <div
              className="mt-1.5 overflow-hidden transition-[grid-template-rows] duration-300"
              style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr" }}
            >
              <div className="min-h-0">
                <p className="pt-1 text-[13px] leading-relaxed text-muted-foreground/80">
                  {article.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            >
              <ChevronDown
                className={`size-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
              {expanded ? "Less" : "Summary"}
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              <Globe className="size-3" />
              {getDomain(article.url)}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

// --- Compact Card (grid items) ---
function ArticleCard({ article }: { article: ArticleData }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const style = getCategoryStyle(article.category);
  const relTime = formatRelativeTime(article.publishedAt);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]">
      {/* Image */}
      <div className="relative h-36 w-full shrink-0 overflow-hidden">
        {article.imageUrl && !imgError ? (
          <img
            src={article.imageUrl}
            alt=""
            onError={() => setImgError(true)}
            className="h-full w-full object-cover opacity-75 transition-opacity duration-300 group-hover:opacity-90"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${style.gradient}`} />
        )}
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0d0d0f] to-transparent" />
        {article.category && (
          <span className={`absolute bottom-2 left-3 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-sm ${style.bg} ${style.text} ${style.border} border`}>
            {article.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground/70">{article.source}</span>
          {relTime && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
              <Clock className="size-2.5" />
              {relTime}
            </span>
          )}
        </div>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link block flex-1"
        >
          <h3 className="line-clamp-3 text-[13px] font-semibold leading-snug text-foreground/85 transition-colors duration-150 group-hover/link:text-foreground">
            {article.title}
          </h3>
        </a>

        {/* Expandable summary */}
        <div
          className="overflow-hidden transition-[grid-template-rows] duration-300"
          style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0">
            <p className="pt-2 text-[12px] leading-relaxed text-muted-foreground/75">
              {article.summary}
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary/70 transition-colors hover:text-primary"
            >
              Read full article
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            <ChevronDown
              className={`size-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Less" : "Summary"}
          </button>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/35">
            <Globe className="size-2.5" />
            {getDomain(article.url)}
          </span>
        </div>
      </div>
    </article>
  );
}

// --- Feed header ---
function FeedHeader({ feed }: { feed: ArticlesFeedData }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Newspaper className="size-3.5 text-primary/60" strokeWidth={1.75} />
        <span className="text-[13px] font-semibold text-foreground/80">{feed.title}</span>
      </div>
      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-primary/60">
        {feed.articles.length} {feed.articles.length === 1 ? "story" : "stories"}
      </span>
    </div>
  );
}

// --- Main export ---
interface ArticlesFeedProps {
  feed: ArticlesFeedData;
}

export function ArticlesFeed({ feed }: ArticlesFeedProps) {
  const [hero, ...rest] = feed.articles;

  if (!hero) return null;

  return (
    <div className="px-4 py-3">
      <FeedHeader feed={feed} />

      {/* Hero */}
      <HeroArticleCard article={hero} />

      {/* Grid */}
      {rest.length > 0 && (
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
