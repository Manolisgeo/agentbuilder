"use client";

import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ClarifyAnswer, ClarifyBlock, ClarifyQuestion } from "@/lib/clarify-types";

type ClarifyCardProps = {
  block: ClarifyBlock;
  onSubmit: (answers: ClarifyAnswer[]) => void;
  submitted?: boolean;
  submittedAnswers?: Record<string, string | string[]>;
};

type AnswerMap = Record<string, string | string[]>;

function ChoiceWidget({
  question,
  value,
  onChange,
  invalid,
}: {
  question: ClarifyQuestion;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{question.text}</legend>
      {question.options?.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
            value === opt
              ? "border border-primary/50 bg-primary/20 text-white"
              : "border border-white/10 text-white/60 hover:border-white/30 hover:text-white",
            invalid && !value ? "border-red-500/50" : ""
          )}
        >
          <span
            className={cn(
              "size-3.5 shrink-0 rounded-full border-2",
              value === opt ? "border-primary bg-primary" : "border-white/30"
            )}
          />
          {opt}
        </button>
      ))}
    </fieldset>
  );
}

function MultiChoiceWidget({
  question,
  value,
  onChange,
  invalid,
}: {
  question: ClarifyQuestion;
  value: string[];
  onChange: (v: string[]) => void;
  invalid: boolean;
}) {
  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{question.text}</legend>
      {value.length > 1 && (
        <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
          {value.length} selected
        </p>
      )}
      {question.options?.map((opt) => {
        const checked = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={checked}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
              checked
                ? "border border-primary/50 bg-primary/20 text-white"
                : "border border-white/10 text-white/60 hover:border-white/30 hover:text-white",
              invalid && value.length === 0 ? "border-red-500/50" : ""
            )}
          >
            <span
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded border-2",
                checked ? "border-primary bg-primary" : "border-white/30"
              )}
            >
              {checked && <Check className="size-2.5 text-black" strokeWidth={3} />}
            </span>
            {opt}
          </button>
        );
      })}
    </fieldset>
  );
}

function ConfirmWidget({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Yes or No">
      {(["yes", "no"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
            value === opt && opt === "yes"
              ? "border-green-500/50 bg-green-500/20 text-green-300"
              : value === opt && opt === "no"
                ? "border-red-500/50 bg-red-500/20 text-red-300"
                : "border-white/10 text-white/60 hover:border-white/30 hover:text-white",
            invalid && !value ? "border-red-500/50" : ""
          )}
        >
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function TextWidget({
  question,
  value,
  onChange,
  invalid,
}: {
  question: ClarifyQuestion;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      aria-required={question.required}
      aria-invalid={invalid}
      className={cn(
        "w-full rounded-md border bg-surface-1 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary",
        invalid ? "border-red-500/50" : "border-white/15"
      )}
    />
  );
}

function TextareaWidget({
  question,
  value,
  onChange,
  invalid,
}: {
  question: ClarifyQuestion;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      aria-required={question.required}
      aria-invalid={invalid}
      className={cn(
        "w-full resize-none rounded-md border bg-surface-1 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary",
        invalid ? "border-red-500/50" : "border-white/15"
      )}
    />
  );
}

function QuestionWidget({
  question,
  answers,
  setAnswer,
  invalidIds,
}: {
  question: ClarifyQuestion;
  answers: AnswerMap;
  setAnswer: (id: string, val: string | string[]) => void;
  invalidIds: Set<string>;
}) {
  const invalid = invalidIds.has(question.id);

  if (question.kind === "choice") {
    return (
      <ChoiceWidget
        question={question}
        value={(answers[question.id] as string) ?? ""}
        onChange={(v) => setAnswer(question.id, v)}
        invalid={invalid}
      />
    );
  }
  if (question.kind === "multi-choice") {
    return (
      <MultiChoiceWidget
        question={question}
        value={(answers[question.id] as string[]) ?? []}
        onChange={(v) => setAnswer(question.id, v)}
        invalid={invalid}
      />
    );
  }
  if (question.kind === "confirm") {
    return (
      <ConfirmWidget
        value={(answers[question.id] as string) ?? ""}
        onChange={(v) => setAnswer(question.id, v)}
        invalid={invalid}
      />
    );
  }
  if (question.kind === "textarea") {
    return (
      <TextareaWidget
        question={question}
        value={(answers[question.id] as string) ?? ""}
        onChange={(v) => setAnswer(question.id, v)}
        invalid={invalid}
      />
    );
  }
  return (
    <TextWidget
      question={question}
      value={(answers[question.id] as string) ?? ""}
      onChange={(v) => setAnswer(question.id, v)}
      invalid={invalid}
    />
  );
}

function ReadOnlySummary({
  block,
  answers,
}: {
  block: ClarifyBlock;
  answers: AnswerMap;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-2/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Check className="size-3.5 text-green-400" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-green-400">
          Answers sent
        </span>
      </div>
      <ol className="space-y-1">
        {block.questions.map((q, i) => {
          const raw = answers[q.id];
          const answerText = Array.isArray(raw) ? raw.join(", ") : raw ?? "—";
          return (
            <li key={q.id} className="flex gap-2 text-xs text-white/50">
              <span className="shrink-0 font-mono text-primary/60">{i + 1}.</span>
              <span>
                {q.text}
                <span className="mx-1 text-white/30">→</span>
                <span className="text-white/70">{answerText}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ClarifyCard({ block, onSubmit, submitted = false, submittedAnswers }: ClarifyCardProps) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState(false);

  function setAnswer(id: string, val: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: val }));
    setInvalidIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleSubmit() {
    const failing = new Set<string>();
    for (const q of block.questions) {
      if (q.required === false) continue;
      const val = answers[q.id];
      const isEmpty =
        val === undefined ||
        val === "" ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) failing.add(q.id);
    }

    if (failing.size > 0) {
      setInvalidIds(failing);
      setValidationError(true);
      return;
    }

    setValidationError(false);
    const collected: ClarifyAnswer[] = block.questions.map((q) => ({
      id: q.id,
      text: q.text,
      answer: answers[q.id] ?? "",
    }));
    onSubmit(collected);
  }

  if (submitted) {
    return <ReadOnlySummary block={block} answers={submittedAnswers ?? answers} />;
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-2/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Circle className="size-2 fill-primary text-primary" />
        <span className="hud-label">Quick questions</span>
      </div>

      {block.context && (
        <p className="mb-4 text-xs leading-relaxed text-white/60">{block.context}</p>
      )}

      <ol className="space-y-5">
        {block.questions.map((q, i) => (
          <li key={q.id}>
            <div className="mb-2 flex items-baseline gap-1.5">
              <span className="font-mono text-xs text-primary">{i + 1}.</span>
              <span className="text-sm font-medium text-white">
                {q.text}
                {q.required === false && (
                  <span className="ml-1.5 text-xs font-normal text-white/40">(optional)</span>
                )}
              </span>
            </div>
            <QuestionWidget
              question={q}
              answers={answers}
              setAnswer={setAnswer}
              invalidIds={invalidIds}
            />
          </li>
        ))}
      </ol>

      <div className="mt-5">
        {validationError && (
          <p className="mb-2 text-xs text-red-400" aria-live="polite">
            Please answer all required questions
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-primary/80"
        >
          Send Answers →
        </button>
      </div>
    </div>
  );
}
