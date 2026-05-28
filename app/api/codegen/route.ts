import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { deepseekChat } from "@/lib/deepseek";
import {
  codeSpecPatchSchema,
  codeSpecSchema,
  defaultCodeSpec,
  mergeCodeSpec,
  type CodeSpec,
  type CodeSpecPatch,
} from "@/lib/codegen-types";
import { buildCodegenSystemPrompt } from "@/lib/codegen-prompt";
import type { CodegenUIMessage } from "@/lib/chat-types";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: "DEEPSEEK_API_KEY is not set. Add it to .env.local." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages: CodegenUIMessage[] = body.messages ?? [];
    const parsedSpec = codeSpecSchema.safeParse(body.codeSpec);
    let currentSpec: CodeSpec = parsedSpec.success ? parsedSpec.data : defaultCodeSpec;

    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream<CodegenUIMessage>({
      execute: ({ writer }) => {
        const result = streamText({
          model: deepseekChat,
          system: buildCodegenSystemPrompt(currentSpec),
          messages: modelMessages,
          tools: {
            updateCodeSpec: {
              description:
                "Update the code architecture spec with nodes representing the agent's structure. Call this before writing the Python script.",
              inputSchema: codeSpecPatchSchema,
              execute: async (patch: CodeSpecPatch) => {
                currentSpec = mergeCodeSpec(currentSpec, patch);
                writer.write({
                  type: "data-codeSpec",
                  id: "code-spec",
                  data: currentSpec,
                });
                return { success: true, nodeCount: currentSpec.nodes.length };
              },
            },
          },
          onFinish: () => {
            writer.write({
              type: "data-codeSpec",
              id: "code-spec",
              data: currentSpec,
            });
          },
        });

        writer.merge(result.toUIMessageStream());
      },
      onError: (error) => {
        console.error("Codegen stream error:", error);
        return error instanceof Error ? error.message : "Code generation failed.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Codegen route error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process code generation request.",
      },
      { status: 500 }
    );
  }
}
