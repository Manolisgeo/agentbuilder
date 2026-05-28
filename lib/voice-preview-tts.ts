import type { AgentSpec } from "@/lib/agent-spec";

/**
 * Module-level dedup + abort coordination that survives React StrictMode
 * remounts and component re-mounts. Dedup is by text content, and a single
 * AbortController per "active speech" guarantees a stale TTS fetch can't
 * arrive after the user has already moved on — that's what was causing
 * multiple voices to play on top of each other.
 */
const spokenTexts = new Set<string>();
let activeTtsAbort: AbortController | null = null;

export function shouldSpeakText(text: string): boolean {
  if (!text) return false;
  if (spokenTexts.has(text)) return false;
  spokenTexts.add(text);
  return true;
}

export function resetSpokenTexts(): void {
  spokenTexts.clear();
  cancelInFlightTts();
}

/** Aborts the currently-pending TTS fetch (if any). Safe to call repeatedly. */
export function cancelInFlightTts(): void {
  if (activeTtsAbort) {
    try {
      activeTtsAbort.abort();
    } catch {
      // ignore
    }
    activeTtsAbort = null;
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function fetchPreviewTtsAudio(
  text: string,
  agentSpec: AgentSpec
): Promise<ArrayBuffer> {
  // Cancel any prior in-flight TTS so its bytes don't arrive late and play
  // on top of the new response.
  cancelInFlightTts();
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  activeTtsAbort = controller;
  const resp = await fetch("/api/voice/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, agentSpec }),
    signal: controller?.signal,
  });
  if (activeTtsAbort === controller) activeTtsAbort = null;
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Text-to-speech failed.");
  }
  return resp.arrayBuffer();
}
