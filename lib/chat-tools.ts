import { generateText, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import {
  addSubAgent,
  addTool,
  removeSubAgent,
  removeTool,
  setEnvVar,
  updateAgentUi,
  updateDeploymentFiles,
  updateDeploymentPlatform,
  updateInstructions,
  updatePersona,
  updateSubAgent,
} from "@/lib/agent-mutations";
import {
  mergeAgentSpec,
  swarmMemoryKeySchema,
  type AgentSpec,
} from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { SwarmUIMessage } from "@/lib/chat-types";
import { clarifyBlockSchema, type ClarifyBlock } from "@/lib/clarify-types";
import { formatArchitectureContext } from "@/lib/graph-context";
import { deepseekChat } from "@/lib/deepseek";
import {
  looseAgentSpecPatchSchema,
  looseAgentUiPatchSchema,
  looseDeploymentCodeSchema,
  parseAgentSpecPatchInput,
  parseAgentUiPatchInput,
  parseDeploymentFilesInput,
  parseDeploymentPlatformInput,
} from "@/lib/tool-schemas";

const planStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

const createPlanSchema = z.object({
  title: z.string(),
  steps: z.array(planStepSchema).min(1),
});

const updatePlanStepSchema = z.object({
  planId: z.string(),
  stepId: z.string(),
  status: z.enum(["pending", "in_progress", "completed"]),
});

const researchSchema = z.object({
  topic: z.string().describe("The topic to research"),
  questions: z
    .array(z.string())
    .optional()
    .describe("Specific questions to answer"),
});

type ToolWriter = UIMessageStreamWriter<SwarmUIMessage>;
type OnClarifySuccess = () => void;

function emitSpec(writer: ToolWriter, spec: AgentSpec) {
  writer.write({
    type: "data-agentSpec",
    id: "agent-spec",
    data: spec,
  });
}

function runSpecMutation(
  writer: ToolWriter,
  getSpec: () => AgentSpec,
  setSpec: (s: AgentSpec) => void,
  mutate: (spec: AgentSpec) => AgentSpec,
  successPayload: Record<string, unknown>
) {
  try {
    const next = mutate(getSpec());
    setSpec(next);
    emitSpec(writer, next);
    return { success: true, ...successPayload };
  } catch (error) {
    console.error("Tool mutation failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Tool execution failed",
    };
  }
}

async function runSafeTool<T extends Record<string, unknown>>(
  fn: () => Promise<T> | T
): Promise<T | { success: false; error: string }> {
  try {
    return await fn();
  } catch (error) {
    console.error("Tool execution failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Tool execution failed",
    };
  }
}

function sharedTools(writer: ToolWriter, getSpec: () => AgentSpec, onClarifySuccess?: OnClarifySuccess) {
  return {
    clarifyUser: {
      description:
        "Ask the user structured clarifying questions before building. Use in discovery to gather requirements about purpose, tone, tools, and constraints. Prefer this over open-ended chat questions for precise, structured input.",
      inputSchema: clarifyBlockSchema,
      execute: async (block: ClarifyBlock) =>
        runSafeTool(async () => {
          writer.write({
            type: "data-clarify",
            id: `clarify-${Date.now()}`,
            data: block,
          });
          onClarifySuccess?.();
          return { sent: true, questionCount: block.questions.length };
        }),
    },
    researchTopic: {
      description:
        "Research a topic to inform agent design. Call proactively when you need domain knowledge, best practices, or context — do not ask the user for permission first.",
      inputSchema: researchSchema,
      execute: async ({
        topic,
        questions,
      }: z.infer<typeof researchSchema>) => {
        try {
          const result = await generateText({
            model: deepseekChat,
            system: `You are a research analyst helping design AI agents. Provide structured, actionable findings.
Format your response as:
## Summary
(2-3 sentences)

## Key findings
- (bullet points)

## Recommendations for agent design
- (specific suggestions)

Be factual and practical. If uncertain, say so.`,
            prompt: `Research topic: ${topic}${
              questions?.length
                ? `\n\nSpecific questions:\n${questions.map((q) => `- ${q}`).join("\n")}`
                : ""
            }`,
          });

          writer.write({
            type: "data-research",
            id: `research-${Date.now()}`,
            data: { topic, findings: result.text },
          });

          return { topic, findings: result.text };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Research failed",
          };
        }
      },
    },
    createPlan: {
      description:
        "Create a structured plan with steps before executing complex work. Use for builds, refactors, or multi-step tasks.",
      inputSchema: createPlanSchema,
      execute: async (plan: z.infer<typeof createPlanSchema>) =>
        runSafeTool(async () => {
          const planId = `plan-${Date.now()}`;
          const fullPlan = {
            id: planId,
            title: plan.title,
            steps: plan.steps.map((s) => ({ ...s, status: "pending" as const })),
          };
          writer.write({
            type: "data-plan",
            id: planId,
            data: fullPlan,
          });
          return fullPlan;
        }),
    },
    updatePlanStep: {
      description: "Update the status of a plan step as you work through it.",
      inputSchema: updatePlanStepSchema,
      execute: async (update: z.infer<typeof updatePlanStepSchema>) =>
        runSafeTool(async () => {
          writer.write({
            type: "data-planStep",
            id: `${update.planId}-${update.stepId}`,
            data: update,
          });
          return update;
        }),
    },
    readArchitecture: {
      description:
        "Read the current agent architecture as a structured summary of all nodes.",
      inputSchema: z.object({}),
      execute: async () => ({
        architecture: formatArchitectureContext(getSpec()),
      }),
    },
  };
}

function buildingTools(
  writer: ToolWriter,
  getSpec: () => AgentSpec,
  setSpec: (s: AgentSpec) => void,
  onClarifySuccess?: OnClarifySuccess
) {
  return {
    ...sharedTools(writer, getSpec, onClarifySuccess),
    updatePersona: {
      description:
        "Update the persona node (name, role, tone). Use for targeted edits to the agent identity.",
      inputSchema: z.object({
        name: z.string().optional(),
        role: z.string().optional(),
        tone: z.string().optional(),
      }),
      execute: async (patch: {
        name?: string;
        role?: string;
        tone?: string;
      }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => updatePersona(spec, patch),
          { node: "persona", ...patch }
        ),
    },
    updateInstructions: {
      description:
        "Update the instructions node (system prompt). Use mode 'append' to add without replacing.",
      inputSchema: z.object({
        instructions: z.string(),
        mode: z.enum(["replace", "append"]).optional(),
      }),
      execute: async ({
        instructions,
        mode = "replace",
      }: {
        instructions: string;
        mode?: "replace" | "append";
      }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => updateInstructions(spec, instructions, mode),
          { node: "instructions", mode }
        ),
    },
    addTool: {
      description:
        "Add or update a tool node connected to the persona. Use descriptive types: gmail_read_inbox, gmail_send_digest, slack_send, http_request, http_api, web_search, file_search, db_query, or custom. For http_request/http_api always supply baseUrl. For file_search supply path (and optionally glob). For db_query supply engine.",
      inputSchema: z.object({
        id: z.string(),
        name: z.string(),
        type: z.string().optional(),
        baseUrl: z.string().optional().describe("Base URL for http_request / http_api tools"),
        path: z.string().optional().describe("Absolute folder path for file_search tools"),
        glob: z.string().optional().describe("File pattern for file_search, e.g. '**/*.pdf'"),
        engine: z.enum(["postgres", "mysql", "sqlite"]).optional().describe("DB engine for db_query tools"),
      }),
      execute: async ({
        id,
        name,
        type = "web_search",
        baseUrl,
        path,
        glob,
        engine,
      }: {
        id: string;
        name: string;
        type?: string;
        baseUrl?: string;
        path?: string;
        glob?: string;
        engine?: "postgres" | "mysql" | "sqlite";
      }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => addTool(spec, { id, name, type, baseUrl, path, glob, engine }),
          { nodeId: `tool-${id}`, name }
        ),
    },
    removeTool: {
      description: "Remove a tool node by its id (without the tool- prefix).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }: { id: string }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => removeTool(spec, id),
          { removed: `tool-${id}` }
        ),
    },
    addSubAgent: {
      description:
        "Add or replace a sub-agent node in a swarm architecture. dependsOn lists other sub-agent ids (not swarm- prefix).",
      inputSchema: z.object({
        id: z.string(),
        role: z.string(),
        instructions: z.string(),
        dependsOn: z.array(z.string()).optional(),
      }),
      execute: async (agent: {
        id: string;
        role: string;
        instructions: string;
        dependsOn?: string[];
      }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) =>
            addSubAgent(spec, {
              ...agent,
              dependsOn: agent.dependsOn ?? [],
            }),
          { nodeId: `swarm-${agent.id}`, role: agent.role }
        ),
    },
    updateSubAgent: {
      description: "Update an existing sub-agent node by id.",
      inputSchema: z.object({
        id: z.string(),
        role: z.string().optional(),
        instructions: z.string().optional(),
        dependsOn: z.array(z.string()).optional(),
      }),
      execute: async (patch: {
        id: string;
        role?: string;
        instructions?: string;
        dependsOn?: string[];
      }) => {
        const { id, ...rest } = patch;
        return runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => updateSubAgent(spec, id, rest),
          { nodeId: `swarm-${id}` }
        );
      },
    },
    removeSubAgent: {
      description: "Remove a sub-agent node by id (without swarm- prefix).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }: { id: string }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => removeSubAgent(spec, id),
          { removed: `swarm-${id}` }
        ),
    },
    updateAgentSpec: {
      description:
        "Bulk patch the agent spec when many fields change at once. Prefer granular tools for single-node edits.",
      inputSchema: looseAgentSpecPatchSchema,
      execute: async (raw: Record<string, unknown>) => {
        const parsed = parseAgentSpecPatchInput(raw);
        if ("error" in parsed) {
          return { success: false, error: parsed.error };
        }
        return runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => mergeAgentSpec(spec, parsed.patch),
          { name: parsed.patch.name ?? getSpec().name }
        );
      },
    },
    updateAgentUi: {
      description:
        "Configure the deployed agent's visual design: template (chat/widget/landing), layout (sidebar/fullscreen/embedded), welcome message, starter prompts, and theme colors/fonts.",
      inputSchema: looseAgentUiPatchSchema,
      execute: async (raw: z.infer<typeof looseAgentUiPatchSchema>) => {
        const parsed = parseAgentUiPatchInput(raw);
        if ("error" in parsed) {
          return { success: false, error: parsed.error };
        }
        return runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => updateAgentUi(spec, parsed.patch),
          {
            template: parsed.patch.template,
            layout: parsed.patch.layout,
          }
        );
      },
    },
    updateDeploymentPlatform: {
      description:
        "Set the deployment target platform and regenerate starter code. Supports html, typescript, python, and react.",
      inputSchema: z.object({
        platform: z.string(),
      }),
      execute: async ({ platform }: { platform: string }) => {
        const parsed = parseDeploymentPlatformInput(platform);
        if ("error" in parsed) {
          return { success: false, error: parsed.error };
        }
        const result = runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => updateDeploymentPlatform(spec, parsed.platform),
          { platform: parsed.platform }
        );
        if ("success" in result && result.success === false) {
          return result;
        }
        const next = getSpec();
        return {
          success: true,
          platform: parsed.platform,
          files: next.deployment?.files.map((f) => f.path) ?? [],
        };
      },
    },
    updateDeploymentCode: {
      description:
        "Add or update deployment source files (HTML, TypeScript, Python, React/TSX). Use after setting the platform to customize generated code.",
      inputSchema: looseDeploymentCodeSchema,
      execute: async (raw: z.infer<typeof looseDeploymentCodeSchema>) => {
        const parsed = parseDeploymentFilesInput(raw);
        if ("error" in parsed) {
          return { success: false, error: parsed.error };
        }
        return runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => {
            const existing = spec.deployment?.files ?? [];
            const merged = [...existing];
            for (const file of parsed.files) {
              const idx = merged.findIndex((f) => f.path === file.path);
              if (idx >= 0) merged[idx] = file;
              else merged.push(file);
            }
            return updateDeploymentFiles(spec, merged);
          },
          { updated: parsed.files.map((f) => f.path) }
        );
      },
    },
    setEnvVar: {
      description:
        "Store a collected credential or environment variable (e.g. GOOGLE_CLIENT_ID) into the agent spec. Call this after the user provides a value via clarifyUser link-input.",
      inputSchema: z.object({
        key: z.string().describe("Env var name, e.g. GOOGLE_CLIENT_ID"),
        value: z.string().describe("The value the user provided"),
      }),
      execute: async ({ key, value }: { key: string; value: string }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => setEnvVar(spec, key, value),
          { key }
        ),
    },
    updateMemoryKeys: {
      description:
        "Define or update shared memory keys for the swarm. Call when you add a new agent that produces or consumes data that other agents need. Use camelCase, descriptive nouns (e.g. 'researchFindings', 'draftText'). After defining keys, set reads/writes on each agent using addSubAgent or updateSubAgent.",
      inputSchema: z.object({
        keys: z.array(swarmMemoryKeySchema),
      }),
      execute: async ({ keys }: { keys: z.infer<typeof swarmMemoryKeySchema>[] }) =>
        runSpecMutation(
          writer,
          getSpec,
          setSpec,
          (spec) => mergeAgentSpec(spec, { swarmMemory: keys }),
          { keyCount: keys.length }
        ),
    },
  };
}

export function createChatTools(
  writer: ToolWriter,
  phase: BuildPhase,
  getSpec: () => AgentSpec,
  setSpec: (s: AgentSpec) => void,
  onClarifySuccess?: OnClarifySuccess
) {
  if (phase === "discovery") {
    return sharedTools(writer, getSpec, onClarifySuccess);
  }
  return buildingTools(writer, getSpec, setSpec, onClarifySuccess);
}
