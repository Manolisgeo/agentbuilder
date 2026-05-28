import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { deepseekChat } from "@/lib/deepseek";
import {
  agentSpecPatchSchema,
  agentSpecSchema,
  defaultAgentSpec,
  mergeAgentSpec,
  type AgentSpec,
  type AgentSpecPatch,
} from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { SwarmUIMessage } from "@/lib/chat-types";

export const maxDuration = 30;

const DISCOVERY_SYSTEM = `You are an agent-building assistant in DISCOVERY mode. Your job is to understand what the user wants before any agent is built.

Rules:
- Have a warm, collaborative conversation to understand their vision
- Ask 1–2 thoughtful questions per turn (never more than 2 at once)
- Over the conversation, explore:
  - What the agent should do (core purpose and tasks)
  - Who it serves and in what context
  - Desired personality and tone
  - Tools or capabilities needed (e.g. web search, research)
  - Constraints, edge cases, or special requirements
- Do NOT describe a final spec or pretend the agent exists yet — you are only gathering requirements
- Periodically summarize what you've learned so the user can confirm or correct
- After 2–3 exchanges, or once you have solid answers on purpose, tone, and capabilities, remind the user they can click "Start building" when ready — or keep refining if they prefer
- Keep responses concise, friendly, and conversational`;

const BUILDING_SYSTEM = `You are an agent-building assistant in BUILD mode. The user has finished discovery and wants you to assemble their agent.

Rules:
- Use everything learned in the conversation to build the agent spec
- Call updateAgentSpec incrementally as you define each part (name/persona first, then tools, then instructions)
- Keep chat responses brief while building — explain what you're adding as you go
- Default tool type is web_search when the user wants search or research capabilities
- Give the agent a memorable name once you understand its purpose
- Prefer incremental updates over waiting for a complete spec`;

function buildSystemPrompt(spec: AgentSpec, phase: BuildPhase): string {
  const base = phase === "discovery" ? DISCOVERY_SYSTEM : BUILDING_SYSTEM;

  if (phase === "discovery") {
    return base;
  }

  return `${base}

Current agent spec:
${JSON.stringify(spec, null, 2)}`;
}

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
        const tools =
          buildPhase === "building"
            ? {
                updateAgentSpec: {
                  description:
                    "Patch the current agent specification with new or updated fields. Call this whenever you learn something about the agent.",
                  inputSchema: agentSpecPatchSchema,
                  execute: async (patch: AgentSpecPatch) => {
                    currentSpec = mergeAgentSpec(currentSpec, patch);
                    writer.write({
                      type: "data-agentSpec",
                      id: "agent-spec",
                      data: currentSpec,
                    });
                    return { success: true, name: currentSpec.name };
                  },
                },
              }
            : undefined;

        const result = streamText({
          model: deepseekChat,
          system: buildSystemPrompt(currentSpec, buildPhase),
          messages: modelMessages,
          tools,
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
