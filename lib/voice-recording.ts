/** Browser mic recording helpers for voice preview. */

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

export function createAudioRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  mimeType: string;
  getChunks: () => Blob[];
} {
  const mimeType = pickRecorderMimeType();
  const recorder =
    mimeType && MediaRecorder.isTypeSupported(mimeType)
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };
  return {
    recorder,
    mimeType: recorder.mimeType || mimeType,
    getChunks: () => chunks,
  };
}

export function startRecording(recorder: MediaRecorder): void {
  recorder.start(200);
}

export function stopRecording(recorder: MediaRecorder): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    recorder.addEventListener("stop", done, { once: true });
    try {
      if (recorder.state === "recording") {
        if (typeof recorder.requestData === "function") {
          recorder.requestData();
        }
        recorder.stop();
      } else {
        resolve();
      }
    } catch {
      resolve();
    }
  });
}

export function isValidRecording(blob: Blob): boolean {
  return blob.size >= 400;
}

export function recordingFileName(mimeType: string): string {
  if (mimeType.includes("mp4")) return "recording.mp4";
  if (mimeType.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}
