import type { UIMessage } from "ai";
import type { MemoryWriteEvent } from "@/lib/swarm-memory";

export type WebSearchSource = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResult = {
  query: string;
  sources: WebSearchSource[];
  answer?: string;
};

export type OrchestrationStepKind =
  | "routing"
  | "delegate"
  | "tool"
  | "synthesize";

export type OrchestrationStepStatus =
  | "pending"
  | "active"
  | "done"
  | "error";

export type OrchestrationStep = {
  id: string;
  kind: OrchestrationStepKind;
  label: string;
  detail?: string;
  agentRole?: string;
  status: OrchestrationStepStatus;
  searchResult?: WebSearchResult;
};

export type OrchestrationState = {
  steps: OrchestrationStep[];
};

export type PreviewUIMessage = UIMessage<
  never,
  {
    orchestration: OrchestrationState;
    memoryState: MemoryWriteEvent;
    gmailAuthRequired: { redirectUrl: string };
  }
>;
