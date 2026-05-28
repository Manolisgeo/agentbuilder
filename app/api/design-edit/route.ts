import { z } from "zod";
import { patchDesignElement } from "@/lib/design-patch";
import { normalizeLlmError } from "@/lib/llm";

const selectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  tagName: z.string(),
  text: z.string(),
  outerHTML: z.string(),
});

const bodySchema = z.object({
  html: z.string().min(1),
  selection: selectionSchema,
  instruction: z.string().min(1),
  agentName: z.string().min(1),
  agentRole: z.string().optional(),
});

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "No LLM API key configured." },
        { status: 500 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request. Missing html, selection, or instruction." },
        { status: 400 }
      );
    }

    const { html, selection, instruction, agentName, agentRole } = parsed.data;

    const patchedHtml = await patchDesignElement(
      { name: agentName, persona: { role: agentRole ?? "", tone: "" } },
      html,
      selection,
      instruction
    );

    return Response.json({ html: patchedHtml });
  } catch (error) {
    console.error("Design edit error:", error);
    return Response.json(
      { error: normalizeLlmError(error) },
      { status: 500 }
    );
  }
}
