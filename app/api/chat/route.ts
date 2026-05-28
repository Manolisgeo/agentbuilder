import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { createChatTools } from "@/lib/chat-tools";
import {
  defaultAgentSpec,
  normalizeAgentSpec,
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
    const parsedSpec = normalizeAgentSpec(body.agentSpec, defaultAgentSpec);
    let currentSpec: AgentSpec = parsedSpec;

    const modelMessages = await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    });

    // Track whether a clarifyUser call actually succeeded so stopWhen
    // doesn't halt on a failed/schema-rejected call.
    let clarifySucceeded = false;

    const stream = createUIMessageStream<SwarmUIMessage>({
      execute: async ({ writer }) => {
        const getSpec = () => currentSpec;
        const setSpec = (spec: AgentSpec) => {
          currentSpec = spec;
        };

        const tools = createChatTools(
          writer,
          buildPhase,
          getSpec,
          setSpec,
          () => { clarifySucceeded = true; }
        );

        const result = streamText({
          model: deepseekChat,
          system: buildOrchestratorPrompt(currentSpec, buildPhase),
          messages: modelMessages,
          tools,
          stopWhen: ({ steps }) => {
            return clarifySucceeded || steps.length >= 30;
          },
          onStepFinish: ({ toolCalls, toolResults }) => {
            // Surface any tool-level errors as visible text so the UI never silently hangs.
            for (let i = 0; i < toolCalls.length; i++) {
              const call = toolCalls[i];
              const result = toolResults?.[i];
              if (
                result &&
                typeof result === "object" &&
                "result" in result &&
                typeof result.result === "object" &&
                result.result !== null &&
                "success" in result.result &&
                result.result.success === false &&
                "error" in result.result
              ) {
                console.error(
                  `[chat] Tool "${call.toolName}" failed:`,
                  result.result.error
                );
              }
            }
          },
          onFinish: ({ finishReason }) => {
            if (buildPhase === "building") {
              writer.write({
                type: "data-agentSpec",
                id: "agent-spec",
                data: currentSpec,
              });
            }
            // If the model was cut off by length or a tool error, append a recovery hint.
            if (finishReason === "length" || finishReason === "error") {
              writer.write({
                type: "text",
                text: `\n\n> ⚠️ Build stopped early (reason: ${finishReason}). You can ask me to continue from where I left off, or click Stop and retry.`,
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
