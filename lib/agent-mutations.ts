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
import { generateDeploymentFiles } from "@/lib/deployment-templates";
import { buildVoiceFrontendHtml } from "@/lib/voice-frontend-template";

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

export function enableVoice(
  spec: AgentSpec,
  options?: { voiceId?: string; ttsModel?: string; sttModel?: string }
): AgentSpec {
  const currentUi = spec.ui ?? defaultAgentUi;
  // agentVoiceSchema .transform() normalizes all four fields — bad voice IDs
  // drop to undefined, hallucinated model names get whitelisted away.
  const withVoice = agentSpecSchema.parse({
    ...spec,
    voice: {
      enabled: true,
      voiceId: options?.voiceId ?? spec.voice?.voiceId,
      ttsModel: options?.ttsModel ?? spec.voice?.ttsModel,
      sttModel: options?.sttModel ?? spec.voice?.sttModel,
    },
    ui: {
      ...currentUi,
      template: "voice",
      welcomeMessage:
        currentUi.welcomeMessage ??
        `Hi, I'm ${spec.name}. Tap the button to start talking.`,
      starterPrompts: [],
    },
  });

  // Always rewrite the stored HTML to the prebuilt template so the design
  // preview and the deployed UI stay in lockstep — voice agents must never
  // ship with LLM-customized HTML that's missing the runtime contract.
  const otherFiles =
    withVoice.deployment?.files.filter((f) => f.path !== "index.html") ?? [];
  return updateDeploymentFiles(
    withVoice,
    [
      ...otherFiles,
      {
        path: "index.html",
        language: "html",
        content: buildVoiceFrontendHtml(withVoice),
      },
    ],
    { designInstruction: "Voice call UI template generated automatically" }
  );
}

/** Updates UI metadata only — does NOT regenerate HTML (use generateAgentFrontend for that). */
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
  return agentSpecSchema.parse({ ...spec, ui: nextUi });
}

export function updateDeploymentPlatform(
  spec: AgentSpec,
  platform: DeploymentPlatform
): AgentSpec {
  const current = spec.deployment ?? defaultAgentDeployment;
  const preservedHtml = current.files.find((f) => f.path === "index.html");
  const clientFiles = generateDeploymentFiles(spec, platform).filter(
    (f) => f.path !== "index.html" && f.path !== "theme.css" && f.path !== "custom.css"
  );
  const files = [
    ...(preservedHtml ? [preservedHtml] : []),
    ...clientFiles,
    ...current.files.filter(
      (f) =>
        f.path !== "index.html" &&
        !clientFiles.some((c) => c.path === f.path)
    ),
  ];

  return agentSpecSchema.parse({
    ...spec,
    deployment: agentDeploymentSchema.parse({
      ...current,
      platform,
      files,
    }),
  });
}

export function updateDeploymentFiles(
  spec: AgentSpec,
  files: AgentDeployment["files"],
  options?: { designInstruction?: string }
): AgentSpec {
  const current = spec.deployment ?? defaultAgentDeployment;

  const processed = files.map((file) => {
    if (file.path === "index.html" && file.content.trim()) {
      return {
        ...file,
        content: file.content.replace(
          /<script id="agent-(builder|voice)-(runtime|preview-bridge)"[\s\S]*?<\/script>/gi,
          ""
        ),
      };
    }
    return file;
  });

  const hasHtml = processed.some(
    (f) => f.path === "index.html" && f.content.trim()
  );

  return agentSpecSchema.parse({
    ...spec,
    deployment: agentDeploymentSchema.parse({
      ...current,
      files: processed,
      ...(hasHtml ? { frontendGenerated: true } : {}),
      ...(options?.designInstruction
        ? { lastFrontendInstruction: options.designInstruction }
        : {}),
    }),
  });
}
