import { resolveVoiceId } from "@/lib/voice";
import { elevenLabsTts, isVoiceApiConfigured, resolveElevenLabsVoiceId } from "@/lib/voice-api";
import type { AgentSpec } from "@/lib/agent-spec";
import { normalizeAgentSpec, defaultAgentSpec } from "@/lib/agent-spec";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isVoiceApiConfigured()) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured in .env." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json({ error: "text is required." }, { status: 400 });
    }

    const spec = normalizeAgentSpec(body.agentSpec, defaultAgentSpec) as AgentSpec;
    const preferredVoiceId = resolveVoiceId(spec);
    const voiceId = await resolveElevenLabsVoiceId(preferredVoiceId);

    const audio = await elevenLabsTts(text, {
      voiceId,
      model: spec.voice?.ttsModel,
    });

    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Text-to-speech failed.",
      },
      { status: 500 }
    );
  }
}
