import type { UIMessage } from "ai";
import type { AgentSpec } from "./agent-spec";

export type SwarmUIMessage = UIMessage<
  never,
  {
    agentSpec: AgentSpec;
  }
>;
