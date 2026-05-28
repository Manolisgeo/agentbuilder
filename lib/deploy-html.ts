import type { AgentSpec } from "@/lib/agent-spec";
import {
  resolveAgentUi,
  type AgentTheme,
  type AgentUi,
} from "@/lib/agent-ui";

export const DEFAULT_CUSTOM_CSS = `/* Custom deployment styles — edit freely */

`;

export type DeployHtmlMode = "static" | "runtime";

export interface BuildDeployHtmlOptions {
  mode?: DeployHtmlMode;
  customCss?: string;
}

const FONT_STACKS: Record<AgentTheme["fontFamily"], string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "ui-serif, Georgia, Cambria, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const RADIUS_VALUES: Record<AgentTheme["borderRadius"], string> = {
  none: "0px",
  md: "12px",
  full: "9999px",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveThemeColors(theme: AgentTheme) {
  const isLight = theme.mode === "light";
  const bg =
    theme.backgroundColor ??
    (isLight ? "#f8fafc" : theme.mode === "auto" ? "#0f0f12" : "#0f0f12");
  const text = isLight ? "#0f172a" : "#f1f5f9";
  const muted = isLight ? "#64748b" : "#94a3b8";
  const surface = isLight ? "#ffffff" : "#18181b";
  const radiusSm = theme.borderRadius === "full" ? "9999px" : "8px";

  return {
    bg,
    text,
    muted,
    surface,
    radius: RADIUS_VALUES[theme.borderRadius],
    radiusSm,
    font: FONT_STACKS[theme.fontFamily],
    primary: theme.primaryColor,
    accent: theme.accentColor ?? theme.primaryColor,
  };
}

function maxWidthForLayout(layout: AgentUi["layout"]): string {
  if (layout === "embedded") return "420px";
  if (layout === "sidebar") return "880px";
  return "720px";
}

export function getDeployCustomCss(spec: AgentSpec): string {
  return (
    spec.deployment?.files.find((file) => file.path === "custom.css")?.content ??
    DEFAULT_CUSTOM_CSS
  );
}

export function buildDeployThemeCss(spec: AgentSpec): string {
  const ui = resolveAgentUi(spec.ui);
  const colors = resolveThemeColors(ui.theme);

  return `:root {
  --agent-primary: ${colors.primary};
  --agent-accent: ${colors.accent};
  --agent-bg: ${colors.bg};
  --agent-surface: ${colors.surface};
  --agent-text: ${colors.text};
  --agent-muted: ${colors.muted};
  --agent-font: ${colors.font};
  --agent-radius: ${colors.radius};
  --agent-radius-sm: ${colors.radiusSm};
  --agent-max-width: ${maxWidthForLayout(ui.layout)};
}
`;
}

function buildDeployShellCss(): string {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: var(--agent-font);
  background: var(--agent-bg);
  color: var(--agent-text);
  min-height: 100vh;
}
.deploy-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.browser-chrome {
  flex-shrink: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--agent-text) 6%, transparent);
  background: color-mix(in srgb, var(--agent-bg) 80%, black);
  padding: 8px 16px;
}
.browser-chrome-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}
.window-dots { display: flex; gap: 6px; }
.window-dots span {
  width: 10px; height: 10px; border-radius: 50%;
}
.window-dots .red { background: rgba(239, 68, 68, 0.6); }
.window-dots .yellow { background: rgba(234, 179, 8, 0.6); }
.window-dots .green { background: rgba(34, 197, 94, 0.6); }
.url-bar {
  margin-left: 8px;
  flex: 1;
  display: flex;
  justify-content: center;
}
.url-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 2px 10px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  background: color-mix(in srgb, var(--agent-text) 4%, transparent);
  color: var(--agent-muted);
}
.url-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--agent-primary);
  box-shadow: 0 0 6px color-mix(in srgb, var(--agent-primary) 80%, transparent);
}
.deploy-viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
  padding: 16px;
}
.agent-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--agent-max-width);
  min-height: 0;
  overflow: hidden;
  background: var(--agent-surface);
  border-radius: var(--agent-radius);
  border: 1px solid color-mix(in srgb, var(--agent-text) 8%, transparent);
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.35);
}
.agent-card[data-template="widget"],
.agent-card[data-template="landing"] {
  margin: auto 0;
}
.agent-header {
  flex-shrink: 0;
  padding: 16px 20px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--agent-primary) 16%, transparent), transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--agent-text) 6%, transparent);
}
.agent-header-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.agent-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--agent-radius-sm);
  border: 1px solid color-mix(in srgb, var(--agent-primary) 35%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, var(--agent-primary) 25%, transparent), color-mix(in srgb, var(--agent-primary) 8%, transparent));
  color: var(--agent-accent);
}
.agent-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.agent-title-row h1 {
  font-size: 14px;
  font-weight: 600;
}
.template-badge {
  border-radius: 9999px;
  padding: 2px 8px;
  font-family: ui-monospace, monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  border: 1px solid color-mix(in srgb, var(--agent-primary) 35%, transparent);
  background: color-mix(in srgb, var(--agent-primary) 12%, transparent);
  color: var(--agent-accent);
}
.agent-role {
  margin-top: 2px;
  font-size: 12px;
  color: var(--agent-muted);
}
.agent-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 20px;
}
.welcome-wrap {
  max-width: 28rem;
  margin: 0 auto;
  text-align: center;
}
.welcome-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin: 0 auto 20px;
  border-radius: var(--agent-radius);
  border: 1px solid color-mix(in srgb, var(--agent-primary) 30%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, var(--agent-primary) 18%, transparent), transparent);
  color: var(--agent-accent);
}
.welcome-text {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
}
.welcome-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--agent-muted);
}
.starters {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}
.starter-btn {
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  border-radius: var(--agent-radius-sm);
  border: 1px solid color-mix(in srgb, var(--agent-text) 8%, transparent);
  background: transparent;
  color: var(--agent-muted);
  transition: opacity 0.15s;
}
.starter-btn:hover:not(:disabled) {
  opacity: 0.9;
  border-color: color-mix(in srgb, var(--agent-primary) 40%, transparent);
  color: var(--agent-text);
  background: color-mix(in srgb, var(--agent-primary) 8%, transparent);
}
.starter-btn:disabled { cursor: default; }
.chat-log {
  display: none;
  flex-direction: column;
  gap: 12px;
}
.chat-log.active { display: flex; }
.welcome-wrap.hidden { display: none; }
.msg {
  padding: 10px 14px;
  border-radius: var(--agent-radius-sm);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 13.5px;
  line-height: 1.55;
}
.msg.user {
  align-self: flex-end;
  max-width: 85%;
  background: color-mix(in srgb, var(--agent-text) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--agent-text) 8%, transparent);
}
.msg.assistant {
  align-self: flex-start;
  max-width: 90%;
  background: color-mix(in srgb, var(--agent-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--agent-primary) 20%, transparent);
}
.msg.empty { color: var(--agent-muted); font-style: italic; }
.agent-composer {
  flex-shrink: 0;
  border-top: 1px solid color-mix(in srgb, var(--agent-text) 6%, transparent);
  padding: 12px 16px;
}
.composer-row {
  display: flex;
  gap: 8px;
}
.composer-row input,
.composer-row textarea {
  flex: 1;
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
  border-radius: var(--agent-radius-sm);
  border: 1px solid color-mix(in srgb, var(--agent-text) 8%, transparent);
  background: transparent;
  color: var(--agent-text);
  resize: none;
  min-height: 42px;
}
.composer-row input:focus,
.composer-row textarea:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--agent-primary) 45%, transparent);
}
.composer-row button {
  padding: 10px 16px;
  border: none;
  border-radius: var(--agent-radius-sm);
  background: var(--agent-primary);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.composer-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`.trim();
}

function botIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
}

function sparklesIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`;
}

function runtimeScript(): string {
  return `
(function () {
  const welcome = document.getElementById("welcome");
  const chatLog = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const messages = [];

  function showChat() {
    if (welcome) welcome.classList.add("hidden");
    if (chatLog) chatLog.classList.add("active");
  }

  function addMsg(role, text) {
    showChat();
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text;
    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
    return el;
  }

  async function send(text) {
    messages.push({ role: "user", content: text });
    addMsg("user", text);
    const el = addMsg("assistant", "…");
    el.classList.add("empty");
    sendBtn.disabled = true;
    let acc = "";
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        el.classList.remove("empty");
        el.textContent = acc;
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    } catch (e) {
      el.textContent = "[connection error] " + e;
    }
    if (!acc) el.textContent = "[no response]";
    else messages.push({ role: "assistant", content: acc });
    sendBtn.disabled = false;
  }

  document.querySelectorAll("[data-starter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-starter");
      if (text && !sendBtn.disabled) send(text);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = "";
    send(text);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
})();
`.trim();
}

export function buildDeployHtml(
  spec: AgentSpec,
  options: BuildDeployHtmlOptions = {}
): string {
  const mode = options.mode ?? "runtime";
  const customCss = options.customCss ?? getDeployCustomCss(spec);
  const ui = resolveAgentUi(spec.ui);
  const slug = spec.name.toLowerCase().replace(/\s+/g, "-");
  const welcome =
    ui.welcomeMessage ?? `Hi! I'm ${spec.name}. How can I help?`;
  const starters = ui.starterPrompts ?? [];
  const role = spec.persona.role || "AI Assistant";
  const isStatic = mode === "static";

  const startersHtml = starters
    .map(
      (prompt) =>
        `          <button class="starter-btn" type="button" data-starter="${escapeHtml(prompt)}"${isStatic ? " disabled" : ""}>${escapeHtml(prompt)}</button>`
    )
    .join("\n");

  const inputTag = isStatic
    ? `<input id="chat-input" type="text" readonly placeholder="Message ${escapeHtml(spec.name)}…" aria-label="Message input" />`
    : `<textarea id="chat-input" placeholder="Message ${escapeHtml(spec.name)}…" rows="1" aria-label="Message input"></textarea>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(spec.name)}</title>
  <style>
${buildDeployThemeCss(spec)}
${buildDeployShellCss()}
  </style>
  <style>${customCss}</style>
</head>
<body>
  <div class="deploy-root">
    <div class="browser-chrome">
      <div class="browser-chrome-inner">
        <div class="window-dots">
          <span class="red"></span>
          <span class="yellow"></span>
          <span class="green"></span>
        </div>
        <div class="url-bar">
          <div class="url-pill">
            <span class="url-dot"></span>
            deploy://${escapeHtml(slug)}
          </div>
        </div>
      </div>
    </div>

    <div class="deploy-viewport">
      <div class="agent-card" data-template="${ui.template}" data-layout="${ui.layout}">
        <header class="agent-header">
          <div class="agent-header-inner">
            <div class="agent-icon">${botIconSvg()}</div>
            <div>
              <div class="agent-title-row">
                <h1>${escapeHtml(spec.name)}</h1>
                <span class="template-badge">${escapeHtml(ui.template)}</span>
              </div>
              <p class="agent-role">${escapeHtml(role)}</p>
            </div>
          </div>
        </header>

        <main class="agent-body">
          <div class="welcome-wrap" id="welcome">
            <div class="welcome-icon">${sparklesIconSvg()}</div>
            <p class="welcome-text">${escapeHtml(welcome)}</p>
            <p class="welcome-hint">End users see this interface with your configured theme, layout, and starter prompts.</p>
            <div class="starters">
${startersHtml}
            </div>
          </div>
          <div class="chat-log" id="chat-log"></div>
        </main>

        <footer class="agent-composer">
          <form id="chat-form" class="composer-row">
            ${inputTag}
            <button id="chat-send" type="submit"${isStatic ? " disabled" : ""}>Send</button>
          </form>
        </footer>
      </div>
    </div>
  </div>
${isStatic ? "" : `  <script>${runtimeScript()}</script>`}
</body>
</html>`;
}

export function buildDeployFileBundle(
  spec: AgentSpec,
  customCss?: string
): Array<{ path: string; language: "html" | "css"; content: string }> {
  const css = customCss ?? getDeployCustomCss(spec);
  return [
    { path: "theme.css", language: "css" as const, content: buildDeployThemeCss(spec) },
    { path: "custom.css", language: "css" as const, content: css },
    {
      path: "index.html",
      language: "html" as const,
      content: buildDeployHtml(spec, { mode: "runtime", customCss: css }),
    },
  ];
}
