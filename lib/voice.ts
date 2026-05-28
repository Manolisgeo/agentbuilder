import type { AgentSpec } from "@/lib/agent-spec";
import { type VoiceInput } from "@/lib/connectors";
import { normalizeSttModel, normalizeTtsModel } from "@/lib/voice-models";

/**
 * Fallback when account voices cannot be fetched at build time.
 * "Sarah" — a `premade` voice available to all accounts (free tier included).
 * Avoid `professional`/library preset IDs here: those require a paid plan and
 * the API rejects them with 402.
 */
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

const VOICE_INTENT_RE =
  /\b(voice[\s-]?agent|call[\s-]?agent|phone[\s-]?agent|voice[\s-]?bot|voice[\s-]?assistant|phone[\s-]?bot|spoken|speak(?:ing)?|talk(?:ing)?|verbal|microphone|\bmic\b|speech[\s-]?(?:to[\s-]?text|input|output)|text[\s-]?to[\s-]?speech|\btts\b|\bstt\b|eleven[\s-]?labs|voice[\s-]?call|call[\s-]?center|ivr)\b/i;

export function detectVoiceIntent(text: string): boolean {
  return VOICE_INTENT_RE.test(text);
}

export function inferVoiceFromSpec(spec: AgentSpec): boolean {
  if (spec.voice?.enabled) return true;
  if (spec.ui?.template === "voice") return true;
  const corpus = [
    spec.name,
    spec.persona.role,
    spec.persona.tone,
    spec.instructions,
    spec.ui?.welcomeMessage ?? "",
    ...(spec.ui?.starterPrompts ?? []),
  ].join("\n");
  return detectVoiceIntent(corpus);
}

export function resolveVoiceId(spec: AgentSpec): string | undefined {
  const id = spec.voice?.voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim();
  return id || undefined;
}

export function resolveVoiceConfig(spec: AgentSpec): VoiceInput | undefined {
  if (!inferVoiceFromSpec(spec)) return undefined;
  return {
    enabled: true,
    voiceId: resolveVoiceId(spec),
    ttsModel: normalizeTtsModel(spec.voice?.ttsModel),
    sttModel: normalizeSttModel(spec.voice?.sttModel),
  };
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}
