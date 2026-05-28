const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const HTML_DOCUMENT_RE = /<!DOCTYPE html>[\s\S]*?<\/html>/gi;
const HTML_ROOT_RE = /<html[\s>][\s\S]*?<\/html>/gi;

function looksLikeDeploymentSource(text: string): boolean {
  return (
    /<!DOCTYPE html>/i.test(text) ||
    /<html[\s>]/i.test(text) ||
    /<\/head>\s*<body/i.test(text) ||
    /export default function/i.test(text) ||
    (/^import /m.test(text) && /^const /m.test(text))
  );
}

/** Strip deployment source from assistant chat — code belongs in Design / Actions only. */
export function sanitizeAssistantChatText(text: string): string {
  const hadCodeBlocks = CODE_BLOCK_RE.test(text);
  const hadHtml = HTML_DOCUMENT_RE.test(text) || HTML_ROOT_RE.test(text);

  const cleaned = text
    .replace(CODE_BLOCK_RE, "")
    .replace(HTML_DOCUMENT_RE, "")
    .replace(HTML_ROOT_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned) {
    if (looksLikeDeploymentSource(cleaned)) {
      return "Deployment files were updated. Open the Design tab to preview the UI and code, or export from Actions.";
    }
    return cleaned;
  }

  if (hadCodeBlocks || hadHtml || looksLikeDeploymentSource(text)) {
    return "Deployment files were updated. Open the Design tab to preview the UI and code, or export from Actions.";
  }

  return cleaned;
}
