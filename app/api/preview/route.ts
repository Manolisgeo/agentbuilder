import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { agentSpecSchema, defaultAgentSpec } from "@/lib/agent-spec";
import { buildAgentRuntimePrompt } from "@/lib/agent-prompt";
import { deepseekChat } from "@/lib/deepseek";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: "DEEPSEEK_API_KEY is not set. Add it to .env.local." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages: UIMessage[] = body.messages ?? [];
    const parsedSpec = agentSpecSchema.safeParse(body.agentSpec);
    const spec = parsedSpec.success ? parsedSpec.data : defaultAgentSpec;

    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const result = streamText({
          model: deepseekChat,
          system: buildAgentRuntimePrompt(spec),
          messages: modelMessages,
        });

        writer.merge(result.toUIMessageStream());
      },
      onError: (error) => {
        console.error("Preview stream error:", error);
        return error instanceof Error
          ? error.message
          : "An error occurred while running the preview.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Preview route error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process preview request.",
      },
      { status: 500 }
    );
  }
}
