import { elevenLabsStt, isVoiceApiConfigured } from "@/lib/voice-api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isVoiceApiConfigured()) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured in .env." },
      { status: 503 }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "audio/webm";
    const audio = Buffer.from(await req.arrayBuffer());
    if (audio.length === 0) {
      return Response.json({ error: "empty audio." }, { status: 400 });
    }

    const sttModel =
      new URL(req.url).searchParams.get("sttModel")?.trim() || undefined;

    const text = await elevenLabsStt(audio, contentType, { model: sttModel });
    return Response.json({ text });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Speech-to-text failed.",
        text: "",
      },
      { status: 500 }
    );
  }
}
