/** Minimal chat runtime contract injected into LLM-generated HTML when missing. */

export const CHAT_RUNTIME_IDS = [
  "chat-form",
  "chat-input",
  "chat-send",
  "chat-log",
] as const;

export function hasChatRuntime(html: string): boolean {
  return CHAT_RUNTIME_IDS.every((id) => html.includes(`id="${id}"`));
}

export function buildChatRuntimeScript(): string {
  return `
(function () {
  var welcome = document.getElementById("welcome");
  var chatLog = document.getElementById("chat-log");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var sendBtn = document.getElementById("chat-send");
  if (!form || !input || !sendBtn || !chatLog) return;

  var messages = [];
  var speak = null;

  function showChat() {
    if (welcome) welcome.classList.add("hidden");
    chatLog.classList.add("active");
  }

  function addMsg(role, text) {
    showChat();
    var el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text;
    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
    return el;
  }

  async function send(text) {
    messages.push({ role: "user", content: text });
    addMsg("user", text);
    var el = addMsg("assistant", "…");
    el.classList.add("empty");
    sendBtn.disabled = true;
    var acc = "";
    try {
      var resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages }),
      });
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        acc += decoder.decode(chunk.value, { stream: true });
        el.classList.remove("empty");
        el.textContent = acc;
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    } catch (e) {
      el.textContent = "[connection error] " + e;
    }
    if (!acc) el.textContent = "[no response]";
    else messages.push({ role: "assistant", content: acc });
    if (acc && speak) speak(acc);
    sendBtn.disabled = false;
  }

  document.querySelectorAll("[data-starter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-starter");
      if (text && !sendBtn.disabled) send(text);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = "";
    send(text);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ElevenLabs voice (mic + speaker), enabled only when the server reports it.
  (async function () {
    var voiceOk = false;
    try {
      var h = await fetch("/health").then(function (r) { return r.json(); });
      voiceOk = Boolean(h && h.voice);
    } catch (e) {}
    if (!voiceOk) return;

    var speakerOn = true;
    speak = async function (text) {
      if (!speakerOn) return;
      try {
        var r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text }),
        });
        if (!r.ok) return;
        var blob = await r.blob();
        new Audio(URL.createObjectURL(blob)).play().catch(function () {});
      } catch (e) {}
    };

    var btnCss = "margin-left:6px;padding:0 10px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:12px;";

    var spk = document.createElement("button");
    spk.type = "button";
    spk.textContent = "Speaker on";
    spk.style.cssText = btnCss;
    spk.addEventListener("click", function () {
      speakerOn = !speakerOn;
      spk.textContent = speakerOn ? "Speaker on" : "Speaker off";
    });

    var mic = document.createElement("button");
    mic.type = "button";
    mic.textContent = "Mic";
    mic.style.cssText = btnCss;
    var recorder = null;
    var chunks = [];
    mic.addEventListener("click", async function () {
      if (recorder && recorder.state === "recording") { recorder.stop(); return; }
      try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        chunks = [];
        recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = async function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          mic.textContent = "Mic";
          mic.disabled = true;
          try {
            var r = await fetch("/api/stt", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: new Blob(chunks, { type: "audio/webm" }) });
            var d = await r.json();
            if (d && d.text) { input.value = d.text; form.requestSubmit(); }
          } catch (e) {}
          mic.disabled = false;
        };
        recorder.start();
        mic.textContent = "Stop";
      } catch (e) {}
    });

    form.appendChild(spk);
    form.appendChild(mic);
  })();
})();
`.trim();
}

export function injectChatRuntime(html: string): string {
  if (html.includes("agent-builder-runtime")) return html;
  const script = `<script id="agent-builder-runtime">${buildChatRuntimeScript()}</script>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `  ${script}\n</body>`);
  }
  return `${html}\n${script}`;
}

/** Builder preview bridge — iframe chat talks to parent via postMessage (uses /api/preview). */
export function buildPreviewBridgeScript(): string {
  return `
(function () {
  var welcome = document.getElementById("welcome");
  var chatLog = document.getElementById("chat-log");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var sendBtn = document.getElementById("chat-send");
  if (!form || !input || !sendBtn || !chatLog) return;

  var pendingEl = null;

  function showChat() {
    if (welcome) welcome.classList.add("hidden");
    chatLog.classList.add("active");
  }

  function addMsg(role, text) {
    showChat();
    var el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text;
    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
    return el;
  }

  function sendToParent(text) {
    addMsg("user", text);
    pendingEl = addMsg("assistant", "…");
    pendingEl.classList.add("empty");
    sendBtn.disabled = true;
    parent.postMessage({ type: "agent-preview-send", text: text }, "*");
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "agent-preview-assistant") {
      if (!pendingEl) pendingEl = addMsg("assistant", "");
      pendingEl.classList.remove("empty");
      pendingEl.textContent = d.text || "";
      chatLog.scrollTop = chatLog.scrollHeight;
      if (d.done) {
        pendingEl = null;
        sendBtn.disabled = false;
      }
    }
    if (d.type === "agent-preview-error") {
      if (pendingEl) pendingEl.textContent = d.message || "Error";
      pendingEl = null;
      sendBtn.disabled = false;
    }
    if (d.type === "agent-preview-reset") {
      chatLog.innerHTML = "";
      chatLog.classList.remove("active");
      if (welcome) welcome.classList.remove("hidden");
      pendingEl = null;
      sendBtn.disabled = false;
    }
  });

  document.querySelectorAll("[data-starter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-starter");
      if (text && !sendBtn.disabled) sendToParent(text);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = "";
    sendToParent(text);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
})();
`.trim();
}

export function injectPreviewBridge(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const script = `<script id="agent-preview-bridge">${buildPreviewBridgeScript()}</script>`;
  if (withoutScripts.includes("</body>")) {
    return withoutScripts.replace("</body>", `  ${script}\n</body>`);
  }
  return `${withoutScripts}\n${script}`;
}

export type FrontendFrameMode = "static" | "live" | "design";

export function prepareFrontendHtml(
  html: string,
  mode: FrontendFrameMode
): string {
  if (mode === "static") {
    return html.replace(/<script[\s\S]*?<\/script>/gi, "");
  }
  return injectPreviewBridge(html);
}

export const FRONTEND_PLACEHOLDER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent UI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0f;
      color: #94a3b8;
      padding: 24px;
    }
    .placeholder {
      max-width: 28rem;
      text-align: center;
      border: 1px dashed rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 32px 24px;
    }
    h1 { font-size: 15px; color: #e2e8f0; margin-bottom: 8px; }
    p { font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="placeholder">
    <h1>No frontend yet</h1>
    <p>Ask the chat to design your agent's UI — describe the look, layout, and brand you want. Each agent gets a unique interface generated from scratch.</p>
  </div>
</body>
</html>`;
