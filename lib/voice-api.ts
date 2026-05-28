import { normalizeSttModel, normalizeTtsModel } from "@/lib/voice-models";

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
let cachedAccountVoiceIds: Set<string> | null = null;

type VoiceListEntry = {
  voice_id: string;
  name?: string;
  category?: string;
};

async function fetchAccountVoices(key: string): Promise<VoiceListEntry[]> {
  const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!resp.ok) {
    throw new Error(
      "Could not list ElevenLabs voices. Set ELEVENLABS_VOICE_ID in .env to a voice from your dashboard."
    );
  }
  const data = (await resp.json()) as { voices?: VoiceListEntry[] };
  return data.voices ?? [];
}

/** Pick the safest free-tier-compatible voice: first premade, else any owned. */
function pickFallbackVoice(voices: VoiceListEntry[]): VoiceListEntry | undefined {
  return (
    voices.find((v) => v.category === "premade") ??
    voices.find((v) => v.category === "cloned" || v.category === "generated") ??
    voices[0]
  );
}

/**
 * Prefer explicit id, then env, then first usable voice on the account.
 * A "usable" voice is one that's actually in the account's voice list —
 * library/professional preset IDs that aren't in the account fail with 402
 * on the free tier, so we silently swap them for a premade voice instead of
 * letting the call blow up.
 */
export async function resolveElevenLabsVoiceId(preferred?: string): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured.");

  const preferredId = preferred?.trim();
  const envId = process.env.ELEVENLABS_VOICE_ID?.trim();

  if (!cachedAccountVoiceIds) {
    const voices = await fetchAccountVoices(key);
    cachedAccountVoiceIds = new Set(voices.map((v) => v.voice_id));
    cachedAccountVoiceId = pickFallbackVoice(voices)?.voice_id ?? null;
  }

  if (preferredId && cachedAccountVoiceIds.has(preferredId)) return preferredId;
  if (envId && cachedAccountVoiceIds.has(envId)) return envId;
  if (cachedAccountVoiceId) return cachedAccountVoiceId;

  throw new Error(
    "No voices on your ElevenLabs account. Create one at elevenlabs.io or set ELEVENLABS_VOICE_ID in .env."
  );
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
        model_id: normalizeTtsModel(options?.model),
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
  form.append("model_id", normalizeSttModel(options?.model));
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
