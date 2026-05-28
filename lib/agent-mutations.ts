import {
  agentSpecSchema,
  MAX_SWARM_AGENTS,
  type AgentSpec,
  type SwarmAgent,
} from "@/lib/agent-spec";
import {
  agentDeploymentSchema,
  agentUiSchema,
  defaultAgentDeployment,
  defaultAgentUi,
  type AgentDeployment,
  type AgentUi,
  type DeploymentPlatform,
} from "@/lib/agent-ui";
import { syncDeployment } from "@/lib/deployment-templates";
import { buildDeployHtml, getDeployCustomCss } from "@/lib/deploy-html";

export function updatePersona(
  spec: AgentSpec,
  patch: { name?: string; role?: string; tone?: string }
): AgentSpec {
  return agentSpecSchema.parse({
    ...spec,
    name: patch.name ?? spec.name,
    persona: {
      role: patch.role ?? spec.persona.role,
      tone: patch.tone ?? spec.persona.tone,
    },
  });
}

export function updateInstructions(
  spec: AgentSpec,
  instructions: string,
  mode: "replace" | "append" = "replace"
): AgentSpec {
  const merged =
    mode === "append" && spec.instructions
      ? `${spec.instructions.trim()}\n\n${instructions.trim()}`
      : instructions;
  return agentSpecSchema.parse({ ...spec, instructions: merged });
}

export function addTool(
  spec: AgentSpec,
  tool: {
    id: string;
    name: string;
    type: string;
    baseUrl?: string;
    path?: string;
    glob?: string;
    engine?: "postgres" | "mysql" | "sqlite";
  }
): AgentSpec {
  if (spec.tools.some((t) => t.id === tool.id)) {
    return agentSpecSchema.parse({
      ...spec,
      tools: spec.tools.map((t) => (t.id === tool.id ? tool : t)),
    });
  }
  return agentSpecSchema.parse({
    ...spec,
    tools: [...spec.tools, tool],
  });
}

export function removeTool(spec: AgentSpec, id: string): AgentSpec {
  return agentSpecSchema.parse({
    ...spec,
    tools: spec.tools.filter((t) => t.id !== id),
  });
}

export function addSubAgent(spec: AgentSpec, agent: SwarmAgent): AgentSpec {
  const agents = spec.agents ?? [];
  if (agents.length >= MAX_SWARM_AGENTS && !agents.some((a) => a.id === agent.id)) {
    throw new Error(`Maximum of ${MAX_SWARM_AGENTS} sub-agents allowed`);
  }
  const existing = agents.find((a) => a.id === agent.id);
  const next = existing
    ? agents.map((a) => (a.id === agent.id ? agent : a))
    : [...agents, agent];
  return agentSpecSchema.parse({ ...spec, agents: next });
}

export function updateSubAgent(
  spec: AgentSpec,
  id: string,
  patch: Partial<Omit<SwarmAgent, "id">>
): AgentSpec {
  const agents = spec.agents ?? [];
  const index = agents.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error(`Sub-agent "${id}" not found`);
  }
  const updated = { ...agents[index], ...patch, id };
  return agentSpecSchema.parse({
    ...spec,
    agents: agents.map((a, i) => (i === index ? updated : a)),
  });
}

export function removeSubAgent(spec: AgentSpec, id: string): AgentSpec {
  const agents = (spec.agents ?? []).filter((a) => a.id !== id);
  return agentSpecSchema.parse({
    ...spec,
    agents: agents.length > 0 ? agents : undefined,
  });
}

export function setEnvVar(spec: AgentSpec, key: string, value: string): AgentSpec {
  return agentSpecSchema.parse({
    ...spec,
    envVars: { ...(spec.envVars ?? {}), [key]: value },
  });
}

export function updateAgentUi(
  spec: AgentSpec,
  patch: Partial<AgentUi> & { theme?: Partial<AgentUi["theme"]> }
): AgentSpec {
  const current = spec.ui ?? defaultAgentUi;
  const nextUi = agentUiSchema.parse({
    ...current,
    ...patch,
    theme: { ...current.theme, ...patch.theme },
  });
  const next = agentSpecSchema.parse({ ...spec, ui: nextUi });
  return agentSpecSchema.parse({
    ...next,
    deployment: syncDeployment(next),
  });
}

export function updateDeploymentPlatform(
  spec: AgentSpec,
  platform: DeploymentPlatform
): AgentSpec {
  return agentSpecSchema.parse({
    ...spec,
    deployment: syncDeployment(spec, platform),
  });
}

export function updateDeploymentFiles(
  spec: AgentSpec,
  files: AgentDeployment["files"],
  options?: { editedPath?: string }
): AgentSpec {
  const current = spec.deployment ?? defaultAgentDeployment;
  const customCss =
    files.find((f) => f.path === "custom.css")?.content ?? getDeployCustomCss(spec);
  const shouldRegenHtml = options?.editedPath !== "index.html";

  let mergedFiles = files;
  if (shouldRegenHtml) {
    const htmlContent = buildDeployHtml(spec, { mode: "runtime", customCss });
    const hasIndex = files.some((f) => f.path === "index.html");
    mergedFiles = hasIndex
      ? files.map((file) =>
          file.path === "index.html"
            ? { ...file, language: "html" as const, content: htmlContent }
            : file
        )
      : [
          ...files,
          { path: "index.html", language: "html" as const, content: htmlContent },
        ];
  }

  return agentSpecSchema.parse({
    ...spec,
    deployment: agentDeploymentSchema.parse({
      ...current,
      files: mergedFiles,
    }),
  });
}
