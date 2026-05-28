import { writeFile } from "fs/promises";
import path from "path";
import { agentSpecSchema } from "@/lib/agent-spec";

const SPEC_PATH = path.join(process.cwd(), ".agent-spec.json");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const spec = agentSpecSchema.parse(body);
    await writeFile(SPEC_PATH, JSON.stringify(spec, null, 2), "utf-8");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Save agent error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save agent" },
      { status: 500 }
    );
  }
}
