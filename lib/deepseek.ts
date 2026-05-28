import { createOpenAI } from "@ai-sdk/openai";

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export const deepseekChat = deepseek.chat("deepseek-chat");
