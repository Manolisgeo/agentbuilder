import type { AgentSpec } from "@/lib/agent-spec";
import { resolveAgentUi } from "@/lib/agent-ui";

/** Polished voice-call HTML with required runtime IDs — no scripts. */
export function buildVoiceFrontendHtml(spec: AgentSpec): string {
  const ui = resolveAgentUi(spec.ui);
  const name = spec.name === "Untitled Agent" ? "Voice Agent" : spec.name;
  const role = spec.persona.role || "Voice assistant";
  const initial = name.charAt(0).toUpperCase();
  const primary = ui.theme.primaryColor || "#3b82f6";
  const bg = ui.theme.backgroundColor || "#070b14";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { min-height: 100%; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background:
        radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, ${primary} 22%, transparent), transparent),
        radial-gradient(ellipse 60% 50% at 100% 100%, rgba(99, 102, 241, 0.12), transparent),
        ${bg};
      color: #e2e8f0;
      padding: 20px;
    }
    .card {
      width: min(400px, 100%);
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 28px 24px 24px;
      box-shadow:
        0 24px 48px rgba(0, 0, 0, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    .avatar {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 60%, #6366f1));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.375rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 14px;
      box-shadow: 0 8px 24px color-mix(in srgb, ${primary} 35%, transparent);
    }
    #voice-agent-name {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #f8fafc;
    }
    #voice-agent-role {
      font-size: 0.8125rem;
      color: #94a3b8;
      margin-top: 4px;
      margin-bottom: 28px;
      text-align: center;
      line-height: 1.4;
      max-width: 280px;
    }
    .call-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
    }
    #voice-call-btn {
      width: 108px;
      height: 108px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(145deg, ${primary}, color-mix(in srgb, ${primary} 75%, #1d4ed8));
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.25;
      cursor: pointer;
      position: relative;
      box-shadow:
        0 12px 32px color-mix(in srgb, ${primary} 40%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    #voice-call-btn:active { transform: scale(0.96); }
    #voice-call-btn.is-recording {
      background: linear-gradient(145deg, #ef4444, #dc2626);
      box-shadow: 0 12px 32px rgba(239, 68, 68, 0.35);
    }
    #voice-call-btn.is-recording::before,
    #voice-call-btn.is-recording::after {
      content: "";
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      border: 2px solid rgba(239, 68, 68, 0.45);
      animation: pulse-ring 1.4s ease-out infinite;
    }
    #voice-call-btn.is-recording::after { animation-delay: 0.5s; }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); opacity: 0.8; }
      100% { transform: scale(1.25); opacity: 0; }
    }
    #voice-status {
      font-size: 0.8125rem;
      color: #64748b;
      min-height: 1.25rem;
      letter-spacing: 0.01em;
    }
    #voice-status.is-active { color: #94a3b8; }
    .transcript-wrap {
      width: 100%;
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 14px 16px;
      min-height: 120px;
      max-height: 240px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .transcript-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #475569;
      margin-bottom: 10px;
    }
    #voice-transcript {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.12) transparent;
    }
    .voice-line {
      font-size: 0.8125rem;
      line-height: 1.55;
    }
    .voice-line-user .voice-label { color: #64748b; font-style: italic; }
    .voice-line-assistant .voice-label { color: ${primary}; font-weight: 600; }
    .voice-label { margin-right: 6px; }
    .voice-text { color: #cbd5e1; }
    form, #chat-log { display: none !important; }
  </style>
</head>
<body>
  <div class="card">
    <div class="avatar" aria-hidden="true">${escapeHtml(initial)}</div>
    <p id="voice-agent-name">${escapeHtml(name)}</p>
    <p id="voice-agent-role">${escapeHtml(role)}</p>
    <div class="call-zone">
      <button id="voice-call-btn" type="button" data-label-idle="Tap to talk" data-label-active="Stop">Tap to talk</button>
      <p id="voice-status">Ready to talk</p>
    </div>
    <div class="transcript-wrap">
      <p class="transcript-label">Conversation</p>
      <div id="voice-transcript"></div>
    </div>
  </div>
  <form id="chat-form"><input id="chat-input" type="hidden" value="" /><button id="chat-send" type="submit"></button></form>
  <div id="chat-log"></div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hasVoiceFrontendHtml(spec: AgentSpec): boolean {
  const html = spec.deployment?.files.find((f) => f.path === "index.html")?.content;
  return Boolean(html?.includes('id="voice-call-btn"'));
}

/** True when stored HTML is an older or LLM-generated voice UI missing our layout contract. */
export function shouldRefreshVoiceHtml(spec: AgentSpec): boolean {
  const html = spec.deployment?.files.find((f) => f.path === "index.html")?.content;
  if (!html?.includes('id="voice-call-btn"')) return true;
  return !html.includes("transcript-wrap") || !html.includes("voice-label");
}
