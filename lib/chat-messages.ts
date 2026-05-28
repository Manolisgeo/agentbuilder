import { isToolUIPart, type UIMessage } from "ai";

/** Drop tool parts that never received a result — they break the next API round-trip. */
export function stripIncompleteToolParts<T extends UIMessage>(messages: T[]): T[] {
  return messages
    .map((message) => ({
      ...message,
      parts: message.parts.filter(
        (part) =>
          !isToolUIPart(part) ||
          (part.state !== "input-streaming" && part.state !== "input-available")
      ),
    }))
    .filter((message) => message.parts.length > 0);
}

/** Keep the latest version of each message when the chat stream reuses ids. */
export function dedupeMessagesById<T extends { id: string }>(messages: T[]): T[] {
  const lastIndexById = new Map<string, number>();
  messages.forEach((message, index) => {
    lastIndexById.set(message.id, index);
  });

  return messages.filter(
    (message, index) => lastIndexById.get(message.id) === index
  );
}

/** Sanitize message history before sending to the API or rendering. */
export function sanitizeChatMessages<T extends UIMessage>(messages: T[]): T[] {
  return dedupeMessagesById(stripIncompleteToolParts(messages));
}

/** Stable React key — index suffix avoids collisions when ids repeat. */
export function getChatMessageKey(message: { id: string }, index: number): string {
  return `${message.id}:${index}`;
}

export function isMissingToolResultError(message: string): boolean {
  return /tool result.*missing for tool call/i.test(message);
}
