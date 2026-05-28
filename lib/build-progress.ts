import { defaultAgentSpec, type AgentSpec } from "./agent-spec";
import type { BuildPhase } from "./build-phase";

export type BuildStage = "persona" | "tools" | "instructions";

export function computeBuildProgress(spec: AgentSpec): number {
  let filled = 0;
  const total = 5;
  if (spec.name && spec.name !== defaultAgentSpec.name) filled++;
  if (spec.persona.role) filled++;
  if (spec.persona.tone) filled++;
  if (spec.instructions) filled++;
  if (spec.tools.length > 0) filled++;
  const base = Math.round((filled / total) * 100);
  const memoryBonus = spec.swarmMemory?.length ? 5 : 0;
  return Math.min(100, base + memoryBonus);
}

export function getBuildStages(spec: AgentSpec): Record<BuildStage, boolean> {
  const personaDone =
    Boolean(spec.persona.role) &&
    spec.name !== defaultAgentSpec.name;
  const toolsDone = spec.tools.length > 0;
  const instructionsDone = Boolean(spec.instructions);

  return {
    persona: personaDone,
    tools: toolsDone,
    instructions: instructionsDone,
  };
}

export function getBuildStatusLabel(
  progress: number,
  isBuilding: boolean,
  hasAgent: boolean,
  buildPhase: BuildPhase = "building"
): string {
  if (buildPhase === "discovery" && !hasAgent) return "DISCOVERY";
  if (isBuilding) return "ASSEMBLING AGENT";
  if (progress >= 100 || (hasAgent && progress >= 80)) return "AGENT READY";
  if (progress >= 60) return "CONFIGURING TOOLS";
  if (progress >= 40) return "WRITING INSTRUCTIONS";
  if (progress >= 20) return "ASSEMBLING PERSONA";
  return "AWAITING INPUT";
}
