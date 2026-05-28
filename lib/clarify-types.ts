import { z } from "zod";

export const clarifyQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["text", "textarea", "choice", "multi-choice", "confirm", "link-input"]),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(true),
  // for link-input kind: a URL to open + an optional label for the link button
  link: z.string().url().optional(),
  linkLabel: z.string().optional(),
});

export const clarifyBlockSchema = z.object({
  context: z.string().optional(),
  questions: z.array(clarifyQuestionSchema).min(1).max(5),
});

export type ClarifyQuestion = z.infer<typeof clarifyQuestionSchema>;
export type ClarifyBlock = z.infer<typeof clarifyBlockSchema>;

export type ClarifyAnswer = {
  id: string;
  text: string;
  answer: string | string[];
};

export function buildAnswerMessage(block: ClarifyBlock, answers: ClarifyAnswer[]): string {
  const lines = answers.map((a, i) => {
    const answerText = Array.isArray(a.answer) ? a.answer.join(", ") : a.answer;
    return `${i + 1}. ${a.text} → ${answerText}`;
  });
  return `Here are my answers:\n${lines.join("\n")}`;
}
