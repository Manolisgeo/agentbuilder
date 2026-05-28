import { generateText, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import {
  addSubAgent,
  addTool,
  removeSubAgent,
  removeTool,
  updateInstructions,
  updatePersona,
  updateSubAgent,
} from "@/lib/agent-mutations";
import {
  agentSpecPatchSchema,
  mergeAgentSpec,
  type AgentSpec,
  type AgentSpecPatch,
} from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { SwarmUIMessage } from "@/lib/chat-types";
import { formatArchitectureContext } from "@/lib/graph-context";
import { deepseekChat } from "@/lib/deepseek";

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

function emitSpec(writer: ToolWriter, spec: AgentSpec) {
  writer.write({
    type: "data-agentSpec",
    id: "agent-spec",
    data: spec,
  });
}

function sharedTools(writer: ToolWriter, getSpec: () => AgentSpec) {
  return {
    researchTopic: {
      description:
        "Research a topic to inform agent design. Call proactively when you need domain knowledge, best practices, or context — do not ask the user for permission first.",
      inputSchema: researchSchema,
      execute: async ({
        topic,
        questions,
      }: z.infer<typeof researchSchema>) => {
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
      },
    },
    createPlan: {
      description:
        "Create a structured plan with steps before executing complex work. Use for builds, refactors, or multi-step tasks.",
      inputSchema: createPlanSchema,
      execute: async (plan: z.infer<typeof createPlanSchema>) => {
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
      },
    },
    updatePlanStep: {
      description: "Update the status of a plan step as you work through it.",
      inputSchema: updatePlanStepSchema,
      execute: async (update: z.infer<typeof updatePlanStepSchema>) => {
        writer.write({
          type: "data-planStep",
          id: `${update.planId}-${update.stepId}`,
          data: update,
        });
        return update;
      },
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
  setSpec: (s: AgentSpec) => void
) {
  return {
    ...sharedTools(writer, getSpec),
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
      }) => {
        const next = updatePersona(getSpec(), patch);
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, node: "persona", ...patch };
      },
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
      }) => {
        const next = updateInstructions(getSpec(), instructions, mode);
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, node: "instructions", mode };
      },
    },
    addTool: {
      description: "Add or update a tool node connected to the persona.",
      inputSchema: z.object({
        id: z.string(),
        name: z.string(),
        type: z.literal("web_search").optional(),
      }),
      execute: async ({
        id,
        name,
        type = "web_search",
      }: {
        id: string;
        name: string;
        type?: "web_search";
      }) => {
        const next = addTool(getSpec(), { id, name, type });
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, nodeId: `tool-${id}`, name };
      },
    },
    removeTool: {
      description: "Remove a tool node by its id (without the tool- prefix).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }: { id: string }) => {
        const next = removeTool(getSpec(), id);
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, removed: `tool-${id}` };
      },
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
      }) => {
        const next = addSubAgent(getSpec(), {
          ...agent,
          dependsOn: agent.dependsOn ?? [],
        });
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, nodeId: `swarm-${agent.id}`, role: agent.role };
      },
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
        const next = updateSubAgent(getSpec(), id, rest);
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, nodeId: `swarm-${id}` };
      },
    },
    removeSubAgent: {
      description: "Remove a sub-agent node by id (without swarm- prefix).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }: { id: string }) => {
        const next = removeSubAgent(getSpec(), id);
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, removed: `swarm-${id}` };
      },
    },
    updateAgentSpec: {
      description:
        "Bulk patch the agent spec when many fields change at once. Prefer granular tools for single-node edits.",
      inputSchema: agentSpecPatchSchema,
      execute: async (patch: AgentSpecPatch) => {
        const next = mergeAgentSpec(getSpec(), patch);
        setSpec(next);
        emitSpec(writer, next);
        return { success: true, name: next.name };
      },
    },
  };
}

export function createChatTools(
  writer: ToolWriter,
  phase: BuildPhase,
  getSpec: () => AgentSpec,
  setSpec: (s: AgentSpec) => void
) {
  if (phase === "discovery") {
    return sharedTools(writer, getSpec);
  }
  return buildingTools(writer, getSpec, setSpec);
}
