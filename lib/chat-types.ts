import type { UIMessage } from "ai";
import type { AgentSpec } from "./agent-spec";
import type { CodeSpec } from "./codegen-types";

export type PlanStepStatus = "pending" | "in_progress" | "completed";

export type PlanStep = {
  id: string;
  title: string;
  description?: string;
  status?: PlanStepStatus;
};

export type AgentPlan = {
  id: string;
  title: string;
  steps: PlanStep[];
};

export type ResearchResult = {
  topic: string;
  findings: string;
};

export type PlanStepUpdate = {
  planId: string;
  stepId: string;
  status: PlanStepStatus;
};

export type SwarmUIMessage = UIMessage<
  never,
  {
    agentSpec: AgentSpec;
    plan: AgentPlan;
    planStep: PlanStepUpdate;
    research: ResearchResult;
  }
>;

export const TOOL_LABELS: Record<string, { active: string; done: string }> = {
  researchTopic: { active: "Researching", done: "Research complete" },
  createPlan: { active: "Creating plan", done: "Plan created" },
  updatePlanStep: { active: "Updating step", done: "Step updated" },
  readArchitecture: { active: "Reading architecture", done: "Architecture loaded" },
  updatePersona: { active: "Updating persona node", done: "Persona updated" },
  updateInstructions: { active: "Updating instructions", done: "Instructions updated" },
  addTool: { active: "Adding tool node", done: "Tool added" },
  removeTool: { active: "Removing tool node", done: "Tool removed" },
  addSubAgent: { active: "Adding sub-agent", done: "Sub-agent added" },
  updateSubAgent: { active: "Updating sub-agent", done: "Sub-agent updated" },
  removeSubAgent: { active: "Removing sub-agent", done: "Sub-agent removed" },
  updateAgentSpec: { active: "Updating agent spec", done: "Spec updated" },
};

export type CodegenUIMessage = UIMessage<
  never,
  { codeSpec: CodeSpec }
>;
