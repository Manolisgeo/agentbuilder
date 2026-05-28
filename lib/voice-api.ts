import {
  DEFAULT_STT_MODEL,
  DEFAULT_TTS_MODEL,
} from "@/lib/connectors";

function getApiKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY?.trim() || undefined;
}

export function isVoiceApiConfigured(): boolean {
  return Boolean(getApiKey());
}

export function formatElevenLabsError(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const obj = detail as { message?: string; status?: string; code?: string };
    if (typeof obj.message === "string" && obj.message.trim()) {
      if (obj.code === "paid_plan_required") {
        return "ElevenLabs free plan cannot use preset library voices via API. Set ELEVENLABS_VOICE_ID in .env to a voice from your account at elevenlabs.io, or upgrade your plan.";
      }
      return obj.message;
    }
  }
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

export function parseElevenLabsErrorBody(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown; error?: string };
    if (parsed.error) return parsed.error;
    if (parsed.detail) return formatElevenLabsError(parsed.detail, fallback);
  } catch {
    // not JSON
  }
  return trimmed.slice(0, 300);
}

let cachedAccountVoiceId: string | null = null;

/** Prefer explicit id, then env, then first voice on the user's ElevenLabs account. */
export async function resolveElevenLabsVoiceId(preferred?: string): Promise<string> {
  if (preferred?.trim()) return preferred.trim();
  if (process.env.ELEVENLABS_VOICE_ID?.trim()) {
    return process.env.ELEVENLABS_VOICE_ID.trim();
  }
  if (cachedAccountVoiceId) return cachedAccountVoiceId;

  const key = getApiKey();
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured.");

  const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!resp.ok) {
    throw new Error(
      "Could not list ElevenLabs voices. Set ELEVENLABS_VOICE_ID in .env to a voice from your dashboard."
    );
  }

  const data = (await resp.json()) as {
    voices?: { voice_id: string; name?: string }[];
  };
  const voice = data.voices?.find((v) => v.voice_id);
  if (!voice?.voice_id) {
    throw new Error(
      "No voices on your ElevenLabs account. Create one at elevenlabs.io or set ELEVENLABS_VOICE_ID in .env."
    );
  }

  cachedAccountVoiceId = voice.voice_id;
  return voice.voice_id;
}

export async function elevenLabsTts(
  text: string,
  options?: { voiceId?: string; model?: string }
): Promise<ArrayBuffer> {
  const key = getApiKey();
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured.");

  const voiceId = await resolveElevenLabsVoiceId(options?.voiceId);
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: options?.model ?? DEFAULT_TTS_MODEL,
      }),
    }
  );

  if (!resp.ok) {
    const raw = await resp.text().catch(() => "");
    throw new Error(parseElevenLabsErrorBody(raw, "ElevenLabs text-to-speech failed."));
  }

  return resp.arrayBuffer();
}

export async function elevenLabsStt(
  audio: Buffer,
  contentType: string,
  options?: { model?: string }
): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured.");

  const mimeType = contentType.split(";")[0]?.trim() || "audio/webm";
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: mimeType }),
    mimeType.includes("mp4") ? "recording.mp4" : mimeType.includes("ogg") ? "recording.ogg" : "recording.webm"
  );
  form.append("model_id", options?.model ?? DEFAULT_STT_MODEL);
  form.append("language_code", "eng");

  const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });

  const data = (await resp.json().catch(() => ({}))) as {
    text?: string;
    detail?: unknown;
  };

  if (!resp.ok) {
    throw new Error(
      formatElevenLabsError(data.detail, "ElevenLabs speech-to-text failed.")
    );
  }

  const text = data.text?.trim() ?? "";
  if (!text) {
    throw new Error("No speech detected — speak clearly and try again.");
  }
  return text;
}
