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

export function getPreviewHtml(
  spec: AgentSpec,
  options?: { mode?: FrontendFrameMode }
): string {
  const mode = options?.mode ?? "static";
  const html = getAgentFrontendHtml(spec) ?? FRONTEND_PLACEHOLDER_HTML;
  if (mode === "design") {
    return injectDesignInspector(html.replace(/<script[\s\S]*?<\/script>/gi, ""));
  }
  return prepareFrontendHtml(html, mode === "live" ? "live" : "static");
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
