"use client";

import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import { SegmentedProgress } from "@/components/hud/segmented-progress";
import { isCodeSpecEmpty, type CodeSpec } from "@/lib/codegen-types";

interface CodegenActionsPanelProps {
  codeSpec: CodeSpec;
  lastCode: string;
  errorMessage: string | null;
  onClearError?: () => void;
  isBuilding?: boolean;
}

function computeCodeProgress(spec: CodeSpec): number {
  if (isCodeSpecEmpty(spec)) return 0;
  let progress = 0;
  const kinds = spec.nodes.map((n) => n.kind);
  if (kinds.includes("trigger")) progress += 25;
  if (kinds.includes("input")) progress += 25;
  if (kinds.includes("processor")) progress += 25;
  if (kinds.includes("output")) progress += 25;
  return progress;
}

function getCodeStatusLabel(progress: number, isBuilding: boolean): string {
  if (isBuilding) return "ASSEMBLING SCRIPT";
  if (progress === 0) return "AWAITING DESCRIPTION";
  if (progress === 100) return "SCRIPT READY";
  return "BUILDING ARCHITECTURE";
}

function NodeKindRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">{label}</p>
      <span
        className={`font-mono text-xs tabular-nums ${count > 0 ? "text-foreground" : "text-muted-foreground/40"}`}
      >
        {count}
      </span>
    </div>
  );
}

export function CodegenActionsPanel({
  codeSpec,
  lastCode,
  errorMessage,
  isBuilding = false,
}: CodegenActionsPanelProps) {
  const [copied, setCopied] = useState(false);
  const progress = computeCodeProgress(codeSpec);
  const statusLabel = getCodeStatusLabel(progress, isBuilding);
  const hasCode = Boolean(lastCode);

  const kindCounts = {
    trigger: codeSpec.nodes.filter((n) => n.kind === "trigger").length,
    input: codeSpec.nodes.filter((n) => n.kind === "input").length,
    processor: codeSpec.nodes.filter((n) => n.kind === "processor").length,
    output: codeSpec.nodes.filter((n) => n.kind === "output").length,
    dependency: codeSpec.nodes.filter((n) => n.kind === "dependency").length,
  };

  function handleDownload() {
    if (!hasCode) return;
    const blob = new Blob([lastCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent.py";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!hasCode) return;
    await navigator.clipboard.writeText(lastCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <HudPanel tier={1} className="flex h-full min-h-[420px] flex-col">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="hud-label">Telemetry</p>
        <h2 className="mt-0.5 text-sm font-medium">Actions</h2>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {errorMessage && (
          <HudError message={errorMessage} />
        )}

        <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 p-3">
          <SegmentedProgress
            value={progress}
            statusLabel={statusLabel}
          />
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 p-3">
          <p className="hud-label mb-3">Script snapshot</p>
          <div className="space-y-2">
            <div>
              <p className="hud-label">Name</p>
              <p className={`mt-0.5 text-sm ${codeSpec.name !== "Untitled Script" ? "text-foreground" : "text-muted-foreground/50"}`}>
                {codeSpec.name || "—"}
              </p>
            </div>
            {codeSpec.description && (
              <>
                <div className="h-px bg-white/[0.06]" />
                <div>
                  <p className="hud-label">Description</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {codeSpec.description}
                  </p>
                </div>
              </>
            )}
            <div className="h-px bg-white/[0.06]" />
            <p className="hud-label mb-1.5">Nodes</p>
            <NodeKindRow label="Triggers" count={kindCounts.trigger} />
            <NodeKindRow label="Inputs" count={kindCounts.input} />
            <NodeKindRow label="Processors" count={kindCounts.processor} />
            <NodeKindRow label="Outputs" count={kindCounts.output} />
            <NodeKindRow label="Dependencies" count={kindCounts.dependency} />
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 p-3">
          <p className="hud-label mb-1">Download script</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Save the generated Python script as agent.py
          </p>
          <Button
            variant="outline"
            className="w-full gap-2 border-white/[0.08] bg-transparent hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary"
            onClick={handleDownload}
            disabled={!hasCode || isBuilding}
          >
            {isBuilding ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="size-4" />
                Download agent.py
              </>
            )}
          </Button>
          {!hasCode && !isBuilding && (
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Awaiting script generation
            </p>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 p-3">
          <p className="hud-label mb-1">Copy script</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Copy full Python source to clipboard
          </p>
          <Button
            variant="outline"
            className="w-full gap-2 border-white/[0.08] bg-transparent hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary"
            onClick={handleCopy}
            disabled={!hasCode || isBuilding}
          >
            {copied ? (
              <>
                <Check className="size-4 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy to clipboard
              </>
            )}
          </Button>
        </div>
      </div>
    </HudPanel>
  );
}
