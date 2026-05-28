import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import {
  agentSpecPatchSchema,
  agentSpecSchema,
  defaultAgentSpec,
  mergeAgentSpec,
  type AgentSpec,
} from "@/lib/agent-spec";
import type { SwarmUIMessage } from "@/lib/chat-types";

export const maxDuration = 30;

const BUILDER_SYSTEM = `You are an agent-building assistant. Help the user collaboratively design an AI agent specification.

Rules:
- Ask at most ONE clarifying question per turn when information is missing
- When you learn anything about the agent, call updateAgentSpec to patch the current spec
- Prefer incremental updates over waiting for a complete spec
- Keep chat responses concise, friendly, and focused on building
- Default tool type is web_search when the user wants search/research capabilities
- Give the agent a memorable name once you understand its purpose`;

function buildSystemPrompt(spec: AgentSpec): string {
  return `${BUILDER_SYSTEM}

Current agent spec:
${JSON.stringify(spec, null, 2)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: SwarmUIMessage[] = body.messages ?? [];
    const parsedSpec = agentSpecSchema.safeParse(body.agentSpec);
    let currentSpec: AgentSpec = parsedSpec.success
      ? parsedSpec.data
      : defaultAgentSpec;

    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream<SwarmUIMessage>({
      execute: ({ writer }) => {
        const result = streamText({
          model: anthropic("claude-sonnet-4-20250514"),
          system: buildSystemPrompt(currentSpec),
          messages: modelMessages,
          tools: {
            updateAgentSpec: {
              description:
                "Patch the current agent specification with new or updated fields. Call this whenever you learn something about the agent.",
              inputSchema: agentSpecPatchSchema,
              execute: async (patch) => {
                currentSpec = mergeAgentSpec(currentSpec, patch);
                writer.write({
                  type: "data-agentSpec",
                  id: "agent-spec",
                  data: currentSpec,
                });
                return { success: true, name: currentSpec.name };
              },
            },
          },
          onFinish: () => {
            writer.write({
              type: "data-agentSpec",
              id: "agent-spec",
              data: currentSpec,
            });
          },
        });

        writer.merge(result.toUIMessageStream());
      },
      onError: (error) => {
        console.error("Chat stream error:", error);
        return error instanceof Error
          ? error.message
          : "An error occurred while building your agent.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Chat route error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process chat request.",
      },
      { status: 500 }
    );
  }
}
