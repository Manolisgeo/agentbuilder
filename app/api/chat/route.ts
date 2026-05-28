import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { createChatTools } from "@/lib/chat-tools";
import {
  agentSpecSchema,
  defaultAgentSpec,
  type AgentSpec,
} from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { SwarmUIMessage } from "@/lib/chat-types";
import { buildOrchestratorPrompt } from "@/lib/orchestrator-prompt";
import { deepseekChat } from "@/lib/deepseek";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: "DEEPSEEK_API_KEY is not set. Add it to .env.local." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages: SwarmUIMessage[] = body.messages ?? [];
    const buildPhase: BuildPhase =
      body.buildPhase === "building" ? "building" : "discovery";
    const parsedSpec = agentSpecSchema.safeParse(body.agentSpec);
    let currentSpec: AgentSpec = parsedSpec.success
      ? parsedSpec.data
      : defaultAgentSpec;

    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream<SwarmUIMessage>({
      execute: ({ writer }) => {
        const getSpec = () => currentSpec;
        const setSpec = (spec: AgentSpec) => {
          currentSpec = spec;
        };

        const tools = createChatTools(
          writer,
          buildPhase,
          getSpec,
          setSpec
        );

        const result = streamText({
          model: deepseekChat,
          system: buildOrchestratorPrompt(currentSpec, buildPhase),
          messages: modelMessages,
          tools,
          stopWhen: ({ steps }) => {
            // Stop immediately after clarifyUser so the agent can't chain
            // another tool call or overwrite the block before the user answers.
            const clarifyFired = steps.some((s) =>
              s.toolCalls.some((tc) => tc.toolName === "clarifyUser")
            );
            return clarifyFired || steps.length >= 20;
          },
          onFinish: () => {
            if (buildPhase === "building") {
              writer.write({
                type: "data-agentSpec",
                id: "agent-spec",
                data: currentSpec,
              });
            }
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
