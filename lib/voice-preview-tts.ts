import type { AgentSpec } from "@/lib/agent-spec";

/**
 * Module-level dedup that survives React StrictMode remounts and component re-mounts.
 * We only dedup by text content; we never abort an in-flight fetch from the parent —
 * the iframe handles late audio by stopping the current playback before starting new audio.
 */
const spokenTexts = new Set<string>();

export function shouldSpeakText(text: string): boolean {
  if (!text) return false;
  if (spokenTexts.has(text)) return false;
  spokenTexts.add(text);
  return true;
}

export function resetSpokenTexts(): void {
  spokenTexts.clear();
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
  const resp = await fetch("/api/voice/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, agentSpec }),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Text-to-speech failed.");
  }
  return resp.arrayBuffer();
}
