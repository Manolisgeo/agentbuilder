import { defaultAgentSpec, hasCustomDesign, type AgentSpec } from "./agent-spec";
import type { BuildPhase } from "./build-phase";

export type BuildStage = "persona" | "tools" | "instructions" | "design";

export function computeBuildProgress(spec: AgentSpec): number {
  let filled = 0;
  const total = 6;
  if (spec.name && spec.name !== defaultAgentSpec.name) filled++;
  if (spec.persona.role) filled++;
  if (spec.persona.tone) filled++;
  if (spec.instructions) filled++;
  if (spec.tools.length > 0) filled++;
  if (hasCustomDesign(spec) || spec.deployment?.files.length) filled++;
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
  const designDone =
    hasCustomDesign(spec) || Boolean(spec.deployment?.files.length);

  return {
    persona: personaDone,
    tools: toolsDone,
    instructions: instructionsDone,
    design: designDone,
  };
}

export function getBuildStatusLabel(
  progress: number,
  isBuilding: boolean,
  hasAgent: boolean,
  buildPhase: BuildPhase = "building"
): string {
  if (buildPhase === "discovery" && !hasAgent) return "Planning your agent";
  if (isBuilding) return "Building your agent…";
  if (progress >= 100 || (hasAgent && progress >= 80)) return "Agent ready";
  if (progress >= 60) return "Setting up tools";
  if (progress >= 50) return "Designing interface";
  if (progress >= 40) return "Writing instructions";
  if (progress >= 20) return "Defining persona";
  return "Ready when you are";
}
