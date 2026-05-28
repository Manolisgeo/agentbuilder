import type { AgentSpec } from "@/lib/agent-spec";
import { getAgentFrontendHtml } from "@/lib/frontend-codegen";
import {
  FRONTEND_PLACEHOLDER_HTML,
  prepareFrontendHtml,
  type FrontendFrameMode,
} from "@/lib/frontend-runtime";
import { injectDesignInspector } from "@/lib/design-inspector";

export const DEFAULT_CUSTOM_CSS = `/* Optional extra styles — edit freely */

`;

export function hasAgentFrontend(spec: AgentSpec): boolean {
  return Boolean(getAgentFrontendHtml(spec)?.trim());
}

/** @deprecated Template generation removed — use getAgentFrontendHtml or FRONTEND_PLACEHOLDER_HTML */
export function getDeployCustomCss(spec: AgentSpec): string {
  return (
    spec.deployment?.files.find((file) => file.path === "custom.css")?.content ??
    DEFAULT_CUSTOM_CSS
  );
}

const SCRIPT_TAG_RE = /<script[\s\S]*?<\/script>/gi;

const previewSrcDocCache = new Map<string, string>();
const PREVIEW_SRCDOC_CACHE_MAX = 16;

function previewSrcDocCacheKey(html: string, mode: FrontendFrameMode): string {
  return `${mode}\0${html}`;
}

function rememberPreviewSrcDoc(key: string, value: string): string {
  if (previewSrcDocCache.size >= PREVIEW_SRCDOC_CACHE_MAX) {
    const oldest = previewSrcDocCache.keys().next().value;
    if (oldest) previewSrcDocCache.delete(oldest);
  }
  previewSrcDocCache.set(key, value);
  return value;
}

/** Build iframe srcDoc from raw HTML — cached because design/live transforms are expensive. */
export function getPreviewSrcDoc(
  html: string,
  mode: FrontendFrameMode = "static"
): string {
  const key = previewSrcDocCacheKey(html, mode);
  const cached = previewSrcDocCache.get(key);
  if (cached !== undefined) return cached;

  let result: string;
  if (mode === "design") {
    result = injectDesignInspector(html.replace(SCRIPT_TAG_RE, ""));
  } else {
    result = prepareFrontendHtml(html, mode === "live" ? "live" : "static");
  }

  return rememberPreviewSrcDoc(key, result);
}

export function getPreviewHtml(
  spec: AgentSpec,
  options?: { mode?: FrontendFrameMode }
): string {
  const mode = options?.mode ?? "static";
  const html = getAgentFrontendHtml(spec) ?? FRONTEND_PLACEHOLDER_HTML;
  return getPreviewSrcDoc(html, mode);
}

export function buildDeployThemeCss(spec: AgentSpec): string {
  void spec;
  return ":root {}\n";
}

/** @deprecated Template HTML generation removed */
export function buildDeployHtml(
  spec: AgentSpec,
  _options?: { mode?: string; customCss?: string; designPicker?: boolean }
): string {
  void _options;
  return getAgentFrontendHtml(spec) ?? FRONTEND_PLACEHOLDER_HTML;
}

/** @deprecated Use deployment.files directly */
export function buildDeployFileBundle(
  spec: AgentSpec,
  customCss?: string
): Array<{ path: string; language: "html" | "css"; content: string }> {
  const css = customCss ?? getDeployCustomCss(spec);
  const html = getAgentFrontendHtml(spec) ?? FRONTEND_PLACEHOLDER_HTML;
  return [
    { path: "theme.css", language: "css" as const, content: buildDeployThemeCss(spec) },
    { path: "custom.css", language: "css" as const, content: css },
    { path: "index.html", language: "html" as const, content: html },
  ];
}

export function injectDesignPicker(html: string): string {
  return html;
}
