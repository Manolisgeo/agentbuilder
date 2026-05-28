import { z } from "zod";
import {
  agentSpecPatchSchema,
  type AgentSpecPatch,
} from "@/lib/agent-spec";
import {
  agentUiSchema,
  deploymentFileSchema,
  type AgentUi,
  type DeploymentPlatform,
} from "@/lib/agent-ui";

const DEPLOYMENT_PLATFORMS = ["html", "typescript", "python", "react"] as const;

/** LLM-facing schemas — intentionally loose; strict validation happens in execute. */
export const looseAgentSpecPatchSchema = z.record(z.string(), z.unknown());

export const looseAgentUiPatchSchema = z.object({
  template: z.string().optional(),
  layout: z.string().optional(),
  welcomeMessage: z.string().optional(),
  welcomeHint: z.string().optional(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  starterPrompts: z.array(z.string()).optional(),
  theme: z
    .object({
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      fontFamily: z.string().optional(),
      borderRadius: z.string().optional(),
      mode: z.string().optional(),
    })
    .optional(),
});

export const looseDeploymentCodeSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      language: z.string(),
      content: z.string(),
    })
  ),
});

const UI_TEMPLATES = ["chat", "widget", "landing", "voice"] as const;
const UI_LAYOUTS = ["sidebar", "fullscreen", "embedded"] as const;
const UI_MODES = ["light", "dark", "auto"] as const;
const UI_FONTS = ["sans", "serif", "mono"] as const;
const UI_RADII = ["none", "md", "full"] as const;
const DEPLOYMENT_LANGUAGES = [
  "typescript",
  "python",
  "html",
  "css",
  "javascript",
  "tsx",
] as const;

function pickEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  if (!value) return fallback;
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const exact = allowed.find((item) => item === normalized);
  if (exact) return exact;
  const fuzzy = allowed.find(
    (item) => normalized.includes(item) || item.includes(normalized)
  );
  return fuzzy ?? fallback;
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

export function parseAgentSpecPatchInput(
  raw: Record<string, unknown>
): { patch: AgentSpecPatch } | { error: string } {
  const normalized = { ...raw };

  if (Array.isArray(normalized.tools)) {
    normalized.tools = normalized.tools.map((tool) => {
      if (typeof tool !== "object" || tool === null) return tool;
      const entry = tool as Record<string, unknown>;
      return {
        ...entry,
        type: typeof entry.type === "string" ? entry.type : "web_search",
      };
    });
  }

  const parsed = agentSpecPatchSchema.safeParse(normalized);
  if (!parsed.success) {
    return { error: formatZodError(parsed.error) };
  }
  return { patch: parsed.data };
}

export function parseAgentUiPatchInput(
  raw: z.infer<typeof looseAgentUiPatchSchema>
): { patch: Partial<AgentUi> & { theme?: Partial<AgentUi["theme"]> } } | { error: string } {
  const theme = raw.theme
    ? {
        primaryColor: raw.theme.primaryColor,
        accentColor: raw.theme.accentColor,
        backgroundColor: raw.theme.backgroundColor,
        fontFamily: raw.theme.fontFamily
          ? pickEnum(raw.theme.fontFamily, UI_FONTS, "sans")
          : undefined,
        borderRadius: raw.theme.borderRadius
          ? pickEnum(raw.theme.borderRadius, UI_RADII, "md")
          : undefined,
        mode: raw.theme.mode
          ? pickEnum(raw.theme.mode, UI_MODES, "dark")
          : undefined,
      }
    : undefined;

  const patch = {
    template: raw.template
      ? pickEnum(raw.template, UI_TEMPLATES, "chat")
      : undefined,
    layout: raw.layout
      ? pickEnum(raw.layout, UI_LAYOUTS, "fullscreen")
      : undefined,
    welcomeMessage: raw.welcomeMessage,
    welcomeHint: raw.welcomeHint,
    heroTitle: raw.heroTitle,
    heroSubtitle: raw.heroSubtitle,
    starterPrompts: raw.starterPrompts,
    theme,
  };

  const parsed = agentUiSchema.partial().extend({
    theme: agentUiSchema.shape.theme.partial().optional(),
  }).safeParse(patch);

  if (!parsed.success) {
    return { error: formatZodError(parsed.error) };
  }

  return {
    patch: parsed.data as Partial<AgentUi> & {
      theme?: Partial<AgentUi["theme"]>;
    },
  };
}

export function parseDeploymentPlatformInput(
  raw: string
): { platform: DeploymentPlatform } | { error: string } {
  const platform = pickEnum(raw, DEPLOYMENT_PLATFORMS, "html");
  return { platform };
}

export function parseDeploymentFilesInput(
  raw: z.infer<typeof looseDeploymentCodeSchema>
): { files: z.infer<typeof deploymentFileSchema>[] } | { error: string } {
  const files = raw.files.map((file) => ({
    ...file,
    language: pickEnum(
      file.language,
      DEPLOYMENT_LANGUAGES,
      file.path.endsWith(".tsx") ? "tsx" : "typescript"
    ),
  }));

  const parsed = z.array(deploymentFileSchema).safeParse(files);
  if (!parsed.success) {
    return { error: formatZodError(parsed.error) };
  }
  return { files: parsed.data };
}
