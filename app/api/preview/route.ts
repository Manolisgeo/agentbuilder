import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { agentSpecSchema, defaultAgentSpec } from "@/lib/agent-spec";
import { isWebSearchConfigured } from "@/lib/web-search";
import type { PreviewUIMessage } from "@/lib/preview-types";
import { runPreviewStream } from "@/lib/preview-runtime";

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
    const messages: PreviewUIMessage[] = body.messages ?? [];
    const parsedSpec = agentSpecSchema.safeParse(body.agentSpec);
    const spec = parsedSpec.success ? parsedSpec.data : defaultAgentSpec;

    const stream = createUIMessageStream<PreviewUIMessage>({
      execute: ({ writer }) => runPreviewStream(spec, messages, writer),
      onError: (error) => {
        console.error("Preview stream error:", error);
        return error instanceof Error
          ? error.message
          : "An error occurred while running the preview.";
      },
    });

    const response = createUIMessageStreamResponse({ stream });
    response.headers.set(
      "X-Swarm-Live-Search",
      isWebSearchConfigured() ? "enabled" : "disabled"
    );
    return response;
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
