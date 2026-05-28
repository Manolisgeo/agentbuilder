import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export const deepseekChat = deepseek.chat("deepseek-chat");

const openaiClient = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const openaiChat = openaiClient?.chat(
  process.env.OPENAI_MODEL ?? "gpt-4o-mini"
);

/** Primary chat model — DeepSeek if configured, otherwise OpenAI. */
export function getChatModel(): LanguageModel {
  if (process.env.DEEPSEEK_API_KEY) return deepseekChat;
  if (openaiChat) return openaiChat;
  throw new Error(
    "No LLM API key configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY in .env.local."
  );
}

export function hasLlmFallback(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY && process.env.OPENAI_API_KEY);
}

export function normalizeLlmError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (/too busy|overloaded|service unavailable/i.test(msg)) {
    const fallbackHint = hasLlmFallback()
      ? " Wait 30 seconds and retry — OpenAI fallback will be used automatically."
      : " Wait 30 seconds and retry, or add OPENAI_API_KEY to .env.local for automatic fallback when DeepSeek is busy.";
    return `The AI provider is temporarily overloaded.${fallbackHint}`;
  }

  if (/failed after \d+ attempts/i.test(msg)) {
    return `The AI provider failed after multiple retries.${hasLlmFallback() ? " Please wait and try again." : " Wait a moment and retry, or add OPENAI_API_KEY to .env.local for fallback."}`;
  }

  if (/rate limit|429/i.test(msg)) {
    return "Rate limit hit. Wait a minute before retrying.";
  }

  return msg;
}

/** Sleep helper for manual retries */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableLlmError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /too busy|overloaded|rate limit|429|503|timeout|failed after \d+ attempts/i.test(
    msg
  );
}

/**
 * Run an LLM call with retries and optional OpenAI fallback when DeepSeek is busy.
 * Used for secondary calls (research) — primary chat uses streamText maxRetries instead.
 */
export async function withLlmRetry<T>(
  fn: (model: LanguageModel) => Promise<T>,
  options?: { maxAttempts?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const models: LanguageModel[] = [];
  if (process.env.DEEPSEEK_API_KEY) models.push(deepseekChat);
  if (openaiChat && process.env.DEEPSEEK_API_KEY) models.push(openaiChat);
  else if (openaiChat) models.push(openaiChat);
  if (models.length === 0) {
    throw new Error("No LLM API key configured.");
  }

  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(model);
      } catch (error) {
        lastError = error;
        const retryable = isRetryableLlmError(error);
        if (!retryable || attempt === maxAttempts) break;
        await delay(Math.min(3000 * 2 ** (attempt - 1), 20000));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
