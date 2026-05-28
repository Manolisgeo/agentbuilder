import type { AgentSpec } from "@/lib/agent-spec";

export function buildVoiceSttUrl(spec: AgentSpec): string {
  const model = spec.voice?.sttModel?.trim();
  if (!model) return "/api/voice/stt";
  return `/api/voice/stt?sttModel=${encodeURIComponent(model)}`;
}

export async function transcribePreviewAudio(
  blob: Blob,
  mimeType: string,
  spec: AgentSpec
): Promise<{ text?: string; error?: string; ok: boolean }> {
  const resp = await fetch(buildVoiceSttUrl(spec), {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: blob,
  });
  const data = (await resp.json()) as { text?: string; error?: string };
  return { ...data, ok: resp.ok };
}
