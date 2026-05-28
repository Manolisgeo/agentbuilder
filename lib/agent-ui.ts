import { z } from "zod";
import type { CSSProperties } from "react";

export const deploymentPlatformSchema = z.enum([
  "html",
  "typescript",
  "python",
  "react",
]);

export const deploymentLanguageSchema = z.enum([
  "typescript",
  "python",
  "html",
  "css",
  "javascript",
  "tsx",
]);

export const agentThemeSchema = z.object({
  primaryColor: z.string(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.enum(["sans", "serif", "mono"]),
  borderRadius: z.enum(["none", "md", "full"]),
  mode: z.enum(["light", "dark", "auto"]),
});

export const agentUiSchema = z.object({
  template: z.enum(["chat", "widget", "landing"]),
  layout: z.enum(["sidebar", "fullscreen", "embedded"]),
  welcomeMessage: z.string().optional(),
  starterPrompts: z.array(z.string()).optional(),
  theme: agentThemeSchema,
});

export const deploymentFileSchema = z.object({
  path: z.string(),
  language: deploymentLanguageSchema,
  content: z.string(),
});

export const agentDeploymentSchema = z.object({
  platform: deploymentPlatformSchema,
  files: z.array(deploymentFileSchema),
});

export type DeploymentPlatform = z.infer<typeof deploymentPlatformSchema>;
export type DeploymentLanguage = z.infer<typeof deploymentLanguageSchema>;
export type AgentTheme = z.infer<typeof agentThemeSchema>;
export type AgentUi = z.infer<typeof agentUiSchema>;
export type DeploymentFile = z.infer<typeof deploymentFileSchema>;
export type AgentDeployment = z.infer<typeof agentDeploymentSchema>;

export const defaultAgentTheme: AgentTheme = {
  primaryColor: "#6366f1",
  accentColor: "#818cf8",
  backgroundColor: "#0f0f12",
  fontFamily: "sans",
  borderRadius: "md",
  mode: "dark",
};

export const defaultAgentUi: AgentUi = {
  template: "chat",
  layout: "fullscreen",
  welcomeMessage: "Hi! How can I help you today?",
  starterPrompts: [
    "What can you help me with?",
    "Tell me about your capabilities",
    "I have a question for you",
  ],
  theme: defaultAgentTheme,
};

export const defaultAgentDeployment: AgentDeployment = {
  platform: "html",
  files: [],
};

const FONT_STACKS: Record<AgentTheme["fontFamily"], string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "ui-serif, Georgia, Cambria, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const RADIUS_VALUES: Record<AgentTheme["borderRadius"], string> = {
  none: "0px",
  md: "12px",
  full: "9999px",
};

export function resolveAgentTheme(theme: AgentTheme): AgentTheme {
  const parsed = agentThemeSchema.safeParse(theme);
  return parsed.success ? parsed.data : defaultAgentTheme;
}

export function resolveAgentUi(ui?: Partial<AgentUi>): AgentUi {
  if (!ui) return defaultAgentUi;
  return agentUiSchema.parse({
    ...defaultAgentUi,
    ...ui,
    theme: resolveAgentTheme({ ...defaultAgentTheme, ...ui.theme }),
    starterPrompts: ui.starterPrompts ?? defaultAgentUi.starterPrompts,
  });
}

export function resolveAgentDeployment(
  deployment?: Partial<AgentDeployment>
): AgentDeployment {
  if (!deployment) return defaultAgentDeployment;
  return agentDeploymentSchema.parse({
    platform: deployment.platform ?? defaultAgentDeployment.platform,
    files: deployment.files ?? [],
  });
}

export function themeToCssVariables(theme: AgentTheme): CSSProperties {
  const resolved = resolveAgentTheme(theme);
  const isLight = resolved.mode === "light";
  const bg =
    resolved.backgroundColor ??
    (isLight ? "#f8fafc" : resolved.mode === "auto" ? "#0f0f12" : "#0f0f12");
  const text = isLight ? "#0f172a" : "#f1f5f9";
  const muted = isLight ? "#64748b" : "#94a3b8";
  const surface = isLight ? "#ffffff" : "#18181b";

  return {
    "--agent-primary": resolved.primaryColor,
    "--agent-accent": resolved.accentColor ?? resolved.primaryColor,
    "--agent-bg": bg,
    "--agent-surface": surface,
    "--agent-text": text,
    "--agent-muted": muted,
    "--agent-font": FONT_STACKS[resolved.fontFamily],
    "--agent-radius": RADIUS_VALUES[resolved.borderRadius],
    "--agent-radius-sm": resolved.borderRadius === "full" ? "9999px" : "8px",
  } as CSSProperties;
}

export function getSyntaxLanguage(
  language: DeploymentLanguage
): "typescript" | "python" | "html" | "css" | "javascript" {
  if (language === "tsx") return "typescript";
  return language;
}

export function getPlatformLabel(platform: DeploymentPlatform): string {
  const labels: Record<DeploymentPlatform, string> = {
    html: "HTML",
    typescript: "TypeScript",
    python: "Python",
    react: "React (TSX)",
  };
  return labels[platform];
}
