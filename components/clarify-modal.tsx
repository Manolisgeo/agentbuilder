"use client";

import { Check, Circle, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { ClarifyAnswer, ClarifyBlock, ClarifyQuestion } from "@/lib/clarify-types";

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
    <fieldset className="space-y-2.5">
      <legend className="sr-only">{question.text}</legend>
      {question.options?.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all",
            value === opt
              ? "border border-primary/50 bg-primary/15 text-foreground shadow-[0_0_0_1px_rgba(255,107,26,0.3)]"
              : "border border-black/[0.08] bg-black/[0.03] text-foreground/70 hover:border-black/20 hover:bg-black/[0.05] hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/70 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-white",
            invalid && !value ? "border-red-500/50" : ""
          )}
        >
          <span
            className={cn(
              "size-4 shrink-0 rounded-full border-2 transition-colors",
              value === opt ? "border-primary bg-primary" : "border-black/25 dark:border-white/30"
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
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  return (
    <fieldset className="space-y-2.5">
      <legend className="sr-only">{question.text}</legend>
      {value.length > 1 && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
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
              "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all",
              checked
                ? "border border-primary/50 bg-primary/15 text-foreground shadow-[0_0_0_1px_rgba(255,107,26,0.3)]"
                : "border border-black/[0.08] bg-black/[0.03] text-foreground/70 hover:border-black/20 hover:bg-black/[0.05] hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/70 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-white",
              invalid && value.length === 0 ? "border-red-500/50" : ""
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                checked ? "border-primary bg-primary" : "border-black/25 dark:border-white/30"
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
    <div className="flex gap-3" role="group">
      {(["yes", "no"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "flex-1 rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-all",
            value === opt && opt === "yes"
              ? "border-green-500/50 bg-green-500/15 text-green-600 dark:text-green-300"
              : value === opt && opt === "no"
                ? "border-red-500/50 bg-red-500/15 text-red-600 dark:text-red-300"
                : "border-black/[0.08] bg-black/[0.03] text-foreground/70 hover:border-black/20 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white",
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
      autoFocus
      className={cn(
        "w-full rounded-xl border bg-black/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
        invalid ? "border-red-500/50" : "border-black/[0.08] dark:border-white/[0.08]"
      )}
    />
  );
}

function LinkInputWidget({
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
      placeholder={question.placeholder ?? "Paste value here…"}
      autoFocus
      className={cn(
        "w-full rounded-xl border bg-black/[0.04] px-4 py-3 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
        invalid ? "border-red-500/50" : "border-black/[0.08] dark:border-white/[0.08]"
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
      rows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      autoFocus
      className={cn(
        "w-full resize-none rounded-xl border bg-black/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
        invalid ? "border-red-500/50" : "border-black/[0.08] dark:border-white/[0.08]"
      )}
    />
  );
}

function QuestionInput({
  question,
  answers,
  setAnswer,
  invalid,
}: {
  question: ClarifyQuestion;
  answers: AnswerMap;
  setAnswer: (id: string, val: string | string[]) => void;
  invalid: boolean;
}) {
  const val = answers[question.id];
  if (question.kind === "choice")
    return <ChoiceWidget question={question} value={(val as string) ?? ""} onChange={(v) => setAnswer(question.id, v)} invalid={invalid} />;
  if (question.kind === "multi-choice")
    return <MultiChoiceWidget question={question} value={(val as string[]) ?? []} onChange={(v) => setAnswer(question.id, v)} invalid={invalid} />;
  if (question.kind === "confirm")
    return <ConfirmWidget value={(val as string) ?? ""} onChange={(v) => setAnswer(question.id, v)} invalid={invalid} />;
  if (question.kind === "textarea")
    return <TextareaWidget question={question} value={(val as string) ?? ""} onChange={(v) => setAnswer(question.id, v)} invalid={invalid} />;
  if (question.kind === "link-input")
    return <LinkInputWidget question={question} value={(val as string) ?? ""} onChange={(v) => setAnswer(question.id, v)} invalid={invalid} />;
  return <TextWidget question={question} value={(val as string) ?? ""} onChange={(v) => setAnswer(question.id, v)} invalid={invalid} />;
}

interface ClarifyModalProps {
  block: ClarifyBlock;
  onSubmit: (answers: ClarifyAnswer[]) => void;
}

function ModalContent({ block, onSubmit }: ClarifyModalProps) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [invalid, setInvalid] = useState(false);

  const questions = block.questions;
  const current = questions[stepIndex];
  const isLast = stepIndex === questions.length - 1;

  // auto-advance for choice/confirm once an answer is picked
  const autoAdvanceKinds = new Set(["choice", "confirm"]);

  function setAnswer(id: string, val: string | string[]) {
    const next = { ...answers, [id]: val };
    setAnswers(next);
    setInvalid(false);

    if (autoAdvanceKinds.has(current.kind)) {
      setTimeout(() => {
        if (isLast) {
          const collected: ClarifyAnswer[] = questions.map((q) => ({
            id: q.id,
            text: q.text,
            answer: next[q.id] ?? "",
          }));
          onSubmit(collected);
        } else {
          setStepIndex((i) => i + 1);
        }
      }, 180);
    }
  }

  function handleNext() {
    if (!current) return;
    if (current.required !== false) {
      const val = answers[current.id];
      const empty = val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
      if (empty) { setInvalid(true); return; }
    }
    setInvalid(false);
    if (isLast) {
      const collected: ClarifyAnswer[] = questions.map((q) => ({
        id: q.id,
        text: q.text,
        answer: answers[q.id] ?? "",
      }));
      onSubmit(collected);
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  if (!current) return null;

  const showNextButton = !autoAdvanceKinds.has(current.kind);

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="hud-label mb-1">Quick questions</p>
          {block.context && (
            <p className="text-xs leading-relaxed text-white/50">{block.context}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {questions.map((_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i < stepIndex
                  ? "size-2 bg-primary/50"
                  : i === stepIndex
                  ? "h-2 w-5 bg-primary"
                  : "size-2 bg-white/15"
              )}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="mb-5">
        <p className="mb-4 text-lg font-medium leading-snug text-white">
          {current.text}
          {current.required === false && (
            <span className="ml-2 text-sm font-normal text-white/40">(optional)</span>
          )}
        </p>

        {/* Link button — shown for any question that provides a link */}
        {current.link && (
          <a
            href={current.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-all hover:border-primary/70 hover:bg-primary/20"
          >
            <span>{current.linkLabel ?? "Open link →"}</span>
            <ExternalLink className="size-4 shrink-0 opacity-70" />
          </a>
        )}

        <QuestionInput
          question={current}
          answers={answers}
          setAnswer={setAnswer}
          invalid={invalid}
        />
        {invalid && (
          <p className="mt-2 text-xs text-red-400">Please answer to continue</p>
        )}
      </div>

      {/* Next / Send button — only for text inputs */}
      {showNextButton && (
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-xl bg-gradient-to-br from-[#ff8a3d] to-[#ff6b1a] px-4 py-3 text-sm font-semibold text-black shadow-[0_4px_16px_-4px_rgba(255,107,26,0.55)] transition-shadow hover:shadow-[0_6px_22px_-4px_rgba(255,107,26,0.75)]"
        >
          {isLast ? "Send answers →" : "Next →"}
        </button>
      )}
    </div>
  );
}

export function ClarifyModal({ block, onSubmit }: ClarifyModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-black/[0.08] bg-gradient-to-br from-white/95 to-white/90 p-8 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/[0.08] dark:from-[#1a1816]/98 dark:to-[#0d0b0a]/98 dark:shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)]">
        <ModalContent block={block} onSubmit={onSubmit} />
      </div>
    </div>,
    document.body
  );
}
