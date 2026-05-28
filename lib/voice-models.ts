/**
 * ElevenLabs voice model whitelist.
 *
 * The LLM can hallucinate model IDs (e.g. "eleven_labs"). When that lands in
 * the spec, the runtime forwards it to ElevenLabs which rejects the request.
 * These helpers force any STT/TTS model passed through here to be one the API
 * actually accepts — invalid/unknown values fall back to the safe default.
 */

export const VALID_STT_MODELS = [
  "scribe_v1",
  "scribe_v1_experimental",
  "scribe_v2",
] as const;
export type SttModel = (typeof VALID_STT_MODELS)[number];

export const DEFAULT_STT_MODEL_ID: SttModel = "scribe_v2";

export const VALID_TTS_MODELS = [
  "eleven_turbo_v2",
  "eleven_turbo_v2_5",
  "eleven_multilingual_v2",
  "eleven_multilingual_v1",
  "eleven_monolingual_v1",
  "eleven_flash_v2",
  "eleven_flash_v2_5",
  "eleven_v3",
] as const;
export type TtsModel = (typeof VALID_TTS_MODELS)[number];

export const DEFAULT_TTS_MODEL_ID: TtsModel = "eleven_turbo_v2_5";

export function normalizeSttModel(input: unknown): SttModel {
  if (typeof input === "string") {
    const trimmed = input.trim() as SttModel;
    if ((VALID_STT_MODELS as readonly string[]).includes(trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_STT_MODEL_ID;
}

export function normalizeTtsModel(input: unknown): TtsModel {
  if (typeof input === "string") {
    const trimmed = input.trim() as TtsModel;
    if ((VALID_TTS_MODELS as readonly string[]).includes(trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_TTS_MODEL_ID;
}
