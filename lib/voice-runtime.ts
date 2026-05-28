/** Voice-call UI contract and runtime scripts (ElevenLabs — not a chatbot). */

export const VOICE_RUNTIME_CONTRACT = `
## Voice call runtime (NOT a chatbot)

This agent is a **voice call agent** powered by ElevenLabs. Build a phone-call interface — **never** a chat widget with message bubbles.

### Required visible elements

- \`id="voice-status"\` — status line: "Ready to talk" / "Listening…" / "Speaking…"
- \`id="voice-call-btn"\` type="button" — **large circular push-to-talk button** (primary interaction)
- \`id="voice-transcript"\` — plain scrolling transcript (single column, no bubbles, no avatars)
- \`id="voice-agent-name"\` — agent name headline
- \`id="voice-agent-role"\` — short role subtitle

### Hidden compatibility layer (display:none or visually hidden — required for runtime)

- \`form id="chat-form"\`
- \`input id="chat-input"\` (can be hidden)
- \`button id="chat-send" type="submit"\`
- \`div id="chat-log"\`

### Design rules

1. **No chat bubbles** — transcript lines are plain text with subtle dividers or timestamps only.
2. **Call-first layout** — large centered orb/button, status above, transcript below.
3. **No text input field visible** — voice is the primary input; typing is not offered.
4. **No starter prompt chips** — optional "Tap to start call" hint only.
5. **Phone/support aesthetic** — think call center, IVR, or voice assistant orb — not Slack/ChatGPT.

Do NOT include JavaScript — runtime is injected automatically.
`.trim();

export function buildVoicePreviewBridgeScript(): string {
  return `
(function () {
  var statusEl = document.getElementById("voice-status");
  var callBtn = document.getElementById("voice-call-btn");
  var transcriptEl = document.getElementById("voice-transcript");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var sendBtn = document.getElementById("chat-send");
  var chatLog = document.getElementById("chat-log");
  if (!callBtn || !form || !input || !sendBtn) return;
  if (window.__voicePreviewBridgeActive) return;
  window.__voicePreviewBridgeActive = true;

  if (chatLog) chatLog.style.display = "none";

  var currentAudio = null;
  var currentAudioUrl = null;
  var pendingEl = null;
  var recording = false;
  var speakerOn = true;

  function setCallBtnIdle() {
    callBtn.textContent = callBtn.getAttribute("data-label-idle") || "Tap to talk";
    callBtn.classList.remove("is-recording");
    recording = false;
  }

  function setCallBtnActive() {
    callBtn.textContent = callBtn.getAttribute("data-label-active") || "Stop";
    callBtn.classList.add("is-recording");
    recording = true;
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text;
    var active = /listening|thinking|processing|speaking/i.test(text);
    statusEl.classList.toggle("is-active", active);
  }

  function makeTranscriptLine(role, text) {
    var line = document.createElement("div");
    line.className = "voice-line voice-line-" + role;
    var label = document.createElement("span");
    label.className = "voice-label";
    label.textContent = role === "user" ? "You" : "Agent";
    var body = document.createElement("span");
    body.className = "voice-text";
    body.textContent = text;
    line.appendChild(label);
    line.appendChild(body);
    return line;
  }

  function appendTranscript(role, text) {
    if (!transcriptEl || !text) return null;
    var line = makeTranscriptLine(role, text);
    transcriptEl.appendChild(line);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
    return line;
  }

  var assistantLineEl = null;

  function stopCurrentAudio() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.src = "";
      } catch (e) {}
      currentAudio = null;
    }
    if (currentAudioUrl) {
      try {
        URL.revokeObjectURL(currentAudioUrl);
      } catch (e) {}
      currentAudioUrl = null;
    }
  }

  function unlockControls() {
    sendBtn.disabled = false;
    callBtn.disabled = false;
    setStatus("Ready to talk");
  }

  function playSpeakAudio(b64) {
    if (!speakerOn || !b64) {
      unlockControls();
      return;
    }
    stopCurrentAudio();

    try {
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var blob = new Blob([bytes], { type: "audio/mpeg" });
      currentAudioUrl = URL.createObjectURL(blob);
      setStatus("Speaking…");
      sendBtn.disabled = true;
      callBtn.disabled = true;
      currentAudio = new Audio(currentAudioUrl);
      currentAudio.onended = function () {
        stopCurrentAudio();
        unlockControls();
      };
      currentAudio.onerror = function () {
        stopCurrentAudio();
        unlockControls();
      };
      currentAudio.play().catch(function () {
        stopCurrentAudio();
        unlockControls();
      });
    } catch (e) {
      unlockControls();
    }
  }

  function setAssistantTranscript(text) {
    if (!transcriptEl || !text) return;
    if (!assistantLineEl) {
      assistantLineEl = makeTranscriptLine("assistant", text);
      transcriptEl.appendChild(assistantLineEl);
    } else {
      var body = assistantLineEl.querySelector(".voice-text");
      if (body) body.textContent = text;
    }
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function sendToParent(text) {
    assistantLineEl = null;
    stopCurrentAudio();
    appendTranscript("user", text);
    pendingEl = true;
    setStatus("Thinking…");
    sendBtn.disabled = true;
    callBtn.disabled = true;
    parent.postMessage({ type: "agent-preview-send", text: text }, "*");
  }

  function playBase64Audio(b64) {
    playSpeakAudio(b64);
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object") return;

    if (d.type === "agent-preview-assistant") {
      if (d.text) setAssistantTranscript(d.text);
      if (d.done) {
        assistantLineEl = null;
        pendingEl = null;
        sendBtn.disabled = true;
        callBtn.disabled = true;
        setStatus("Preparing voice…");
      }
    }
    if (d.type === "agent-preview-error") {
      setAssistantTranscript(d.message || "Error");
      assistantLineEl = null;
      pendingEl = null;
      stopCurrentAudio();
      unlockControls();
    }
    if (d.type === "agent-preview-reset") {
      if (transcriptEl) transcriptEl.innerHTML = "";
      assistantLineEl = null;
      stopCurrentAudio();
      pendingEl = null;
      sendBtn.disabled = false;
      callBtn.disabled = false;
      setStatus("Ready to talk");
    }
    if (d.type === "agent-preview-stt-result") {
      callBtn.disabled = false;
      setCallBtnIdle();
      if (d.text) sendToParent(d.text);
      else setStatus("Ready to talk");
    }
    if (d.type === "agent-preview-stt-error") {
      callBtn.disabled = false;
      setCallBtnIdle();
      setStatus(d.message || "Could not transcribe — try again");
    }
    if (d.type === "agent-preview-record-error") {
      callBtn.disabled = false;
      setCallBtnIdle();
      setStatus(d.message || "Microphone access denied");
    }
    if (d.type === "agent-preview-tts-pending") {
      sendBtn.disabled = true;
      callBtn.disabled = true;
      setStatus("Preparing voice…");
    }
    if (d.type === "agent-preview-tts-cancel") {
      stopCurrentAudio();
      unlockControls();
    }
    if (d.type === "agent-preview-tts-audio") {
      playBase64Audio(d.audio);
    }
    if (d.type === "agent-preview-tts-error") {
      stopCurrentAudio();
      unlockControls();
      setStatus(d.message || "Voice playback unavailable");
    }
  });

  callBtn.addEventListener("click", function () {
    if (sendBtn.disabled) return;
    if (recording) {
      setStatus("Processing…");
      callBtn.disabled = true;
      parent.postMessage({ type: "agent-preview-record-stop" }, "*");
      return;
    }
    setStatus("Listening…");
    setCallBtnActive();
    parent.postMessage({ type: "agent-preview-record-start" }, "*");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = "";
    sendToParent(text);
  });

  setStatus("Ready to talk");
})();
`.trim();
}

export function buildVoiceDeployRuntimeScript(): string {
  return `
(function () {
  var statusEl = document.getElementById("voice-status");
  var callBtn = document.getElementById("voice-call-btn");
  var transcriptEl = document.getElementById("voice-transcript");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var sendBtn = document.getElementById("chat-send");
  var chatLog = document.getElementById("chat-log");
  if (!callBtn || !form || !input || !sendBtn || !chatLog) return;

  chatLog.style.display = "none";

  var messages = [];
  var speak = null;
  var speakerOn = true;
  var recorder = null;
  var chunks = [];

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function appendTranscript(role, text) {
    if (!transcriptEl || !text) return;
    var line = document.createElement("div");
    line.className = "voice-line voice-line-" + role;
    line.textContent = (role === "user" ? "You" : "Agent") + ": " + text;
    transcriptEl.appendChild(line);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  async function send(text) {
    messages.push({ role: "user", content: text });
    appendTranscript("user", text);
    setStatus("Thinking…");
    sendBtn.disabled = true;
    callBtn.disabled = true;
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
      }
    } catch (e) {
      acc = "[connection error]";
    }
    if (!acc) acc = "[no response]";
    messages.push({ role: "assistant", content: acc });
    appendTranscript("assistant", acc);
    sendBtn.disabled = false;
    callBtn.disabled = false;
    setStatus("Ready to talk");
    if (acc && speak) speak(acc);
  }

  (async function () {
    var voiceOk = false;
    try {
      var h = await fetch("/health").then(function (r) { return r.json(); });
      voiceOk = Boolean(h && h.voice);
    } catch (e) {}
    if (!voiceOk) {
      setStatus("Voice not configured — set ELEVENLABS_API_KEY");
      return;
    }

    speak = async function (text) {
      if (!speakerOn) return;
      try {
        setStatus("Speaking…");
        var r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text }),
        });
        if (!r.ok) { setStatus("Ready to talk"); return; }
        var blob = await r.blob();
        var audio = new Audio(URL.createObjectURL(blob));
        audio.onended = function () { setStatus("Ready to talk"); };
        await audio.play();
      } catch (e) {
        setStatus("Ready to talk");
      }
    };

    callBtn.addEventListener("click", async function () {
      if (sendBtn.disabled) return;
      if (recorder && recorder.state === "recording") { recorder.stop(); return; }
      try {
        setStatus("Listening…");
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        chunks = [];
        recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = async function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          callBtn.textContent = callBtn.getAttribute("data-label-idle") || "Tap to talk";
          callBtn.disabled = true;
          setStatus("Processing…");
          try {
            var r = await fetch("/api/stt", {
              method: "POST",
              headers: { "Content-Type": "audio/webm" },
              body: new Blob(chunks, { type: "audio/webm" }),
            });
            var d = await r.json();
            if (d && d.text) await send(d.text);
            else setStatus("Could not hear you — try again");
          } catch (e) {
            setStatus("Ready to talk");
          }
          callBtn.disabled = false;
        };
        recorder.start();
        callBtn.textContent = callBtn.getAttribute("data-label-active") || "Stop";
      } catch (e) {
        setStatus("Microphone access denied");
      }
    });

    setStatus("Ready to talk");
  })();
})();
`.trim();
}

export function ensureVoiceShell(html: string, agentName = "Agent"): string {
  const compatLayer = `<form id="chat-form" style="display:none"><input id="chat-input" /><button id="chat-send" type="submit"></button></form>
    <div id="chat-log" style="display:none"></div>`;

  let result = html;
  const needsCompat =
    !html.includes('id="chat-form"') ||
    !html.includes('id="chat-input"') ||
    !html.includes('id="chat-send"');
  if (needsCompat) {
    result = result.includes("</body>")
      ? result.replace("</body>", `${compatLayer}\n</body>`)
      : `${result}\n${compatLayer}`;
  }

  if (html.includes('id="voice-call-btn"')) {
    return result;
  }

  const hideStyle = `<style id="voice-mode-override">
    body > :not(#voice-shell):not(script):not(style):not(#voice-mode-override) {
      display: none !important;
    }
    html, body { margin: 0; padding: 0; min-height: 100%; background: #0a0a0f; }
    #voice-shell {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      min-height: 100vh;
      width: 100%;
    }
  </style>`;

  const shellCompat = needsCompat ? "" : compatLayer;

  const shell = `
  ${hideStyle}
  <div id="voice-shell" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;box-sizing:border-box;">
    <p id="voice-agent-name" style="font-size:22px;font-weight:600;margin:0 0 4px;">${agentName}</p>
    <p id="voice-agent-role" style="font-size:13px;color:#94a3b8;margin:0 0 24px;">Voice agent</p>
    <p id="voice-status" style="font-size:14px;color:#94a3b8;margin:0 0 20px;">Ready to talk</p>
    <button id="voice-call-btn" type="button" data-label-idle="Tap to talk" data-label-active="Stop" style="width:112px;height:112px;border-radius:50%;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 8px 32px rgba(99,102,241,0.4);">Tap to talk</button>
    <p style="margin-top:12px;font-size:12px;color:#64748b;">Hold, speak, then tap Stop</p>
    <div id="voice-transcript" style="margin-top:20px;width:min(480px,100%);max-height:220px;overflow-y:auto;font-size:13px;line-height:1.6;color:#cbd5e1;"></div>
    ${shellCompat}
  </div>`;

  if (result.includes("</body>")) {
    return result.replace("</body>", `${shell}\n</body>`);
  }
  return `${result}\n${shell}`;
}

export function injectVoicePreviewBridge(html: string, agentName?: string): string {
  const prepared = ensureVoiceShell(html, agentName);
  const withoutScripts = prepared.replace(/<script[\s\S]*?<\/script>/gi, "");
  const script = `<script id="agent-voice-preview-bridge">${buildVoicePreviewBridgeScript()}</script>`;
  if (withoutScripts.includes("</body>")) {
    return withoutScripts.replace("</body>", `  ${script}\n</body>`);
  }
  return `${withoutScripts}\n${script}`;
}

export function injectVoiceDeployRuntime(html: string, agentName?: string): string {
  if (html.includes("agent-voice-runtime")) return html;
  const prepared = ensureVoiceShell(html, agentName);
  const script = `<script id="agent-voice-runtime">${buildVoiceDeployRuntimeScript()}</script>`;
  if (prepared.includes("</body>")) {
    return prepared.replace("</body>", `  ${script}\n</body>`);
  }
  return `${prepared}\n${script}`;
}
