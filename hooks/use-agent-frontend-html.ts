import { useMemo } from "react";
import type { AgentSpec } from "@/lib/agent-spec";
import { getAgentFrontendHtml } from "@/lib/frontend-codegen";

/** Stable index.html content — only changes when the file content changes. */
export function useAgentFrontendHtml(agentSpec: AgentSpec): string | null {
  const htmlContent = agentSpec.deployment?.files.find(
    (file) => file.path === "index.html"
  )?.content;

  return useMemo(
    () => getAgentFrontendHtml(agentSpec),
    [htmlContent]
  );
}
