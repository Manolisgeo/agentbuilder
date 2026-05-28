"use client";

import { Download, FileJson, FileText, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import { SegmentedProgress } from "@/components/hud/segmented-progress";
import { downloadAgentBundle } from "@/lib/export";
import { isAgentPreviewReady } from "@/lib/agent-prompt";
import { isAgentSpecEmpty, type AgentSpec } from "@/lib/agent-spec";
import { cn } from "@/lib/utils";

interface ActionsPanelProps {
  agentSpec: AgentSpec;
  errorMessage: string | null;
  onClearError: () => void;
  buildProgress?: number;
  statusLabel?: string;
  isBuilding?: boolean;
  onPreview?: () => void;
}

function SpecRow({ label, value }: { label: string; value: string }) {
  const filled = Boolean(value);
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="hud-label shrink-0 pt-0.5">{label}</span>
      {filled ? (
        <span className="min-w-0 max-w-[60%] truncate text-right text-[12px] text-foreground/90">
          {value}
        </span>
      ) : (
        <span className="shimmer h-3 w-16 shrink-0" aria-hidden />
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="size-1 rounded-full bg-primary/70" />
      <p className="hud-label">{children}</p>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
    </div>
  );
}

export function ActionsPanel({
  agentSpec,
  errorMessage,
  onClearError,
  buildProgress = 0,
  statusLabel = "AWAITING INPUT",
  isBuilding = false,
  onPreview,
}: ActionsPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const canExport = !isAgentSpecEmpty(agentSpec);
  const canPreview = isAgentPreviewReady(agentSpec);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    onClearError();
    try {
      await downloadAgentBundle(agentSpec);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Export failed."
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <HudPanel tier={1} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-system/40" />
            <span className="relative size-1.5 rounded-full bg-system shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
          </span>
          <div>
            <p className="hud-label leading-none">Telemetry</p>
            <h2 className="mt-1 text-[13px] font-medium leading-none text-foreground">
              Actions
            </h2>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5">
        {(errorMessage || exportError) && (
          <HudError message={errorMessage || exportError || ""} />
        )}

        {/* Build progress */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SegmentedProgress
            value={buildProgress}
            statusLabel={isBuilding ? "ASSEMBLING AGENT" : statusLabel}
          />
        </div>

        {/* Agent snapshot */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Agent snapshot</SectionHeader>
          <div className="divide-y divide-white/[0.04]">
            <SpecRow label="Name" value={agentSpec.name === "Untitled Agent" ? "" : agentSpec.name} />
            <SpecRow label="Role" value={agentSpec.persona.role} />
            <SpecRow label="Tone" value={agentSpec.persona.tone} />
            <SpecRow
              label="Tools"
              value={
                agentSpec.tools.length > 0
                  ? agentSpec.tools.map((t) => t.name).join(", ")
                  : ""
              }
            />
            <SpecRow
              label="Instructions"
              value={
                agentSpec.instructions
                  ? agentSpec.instructions.slice(0, 28) +
                    (agentSpec.instructions.length > 28 ? "…" : "")
                  : ""
              }
            />
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Pre-deploy preview</SectionHeader>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Test your agent as an end user before exporting.
          </p>
          <Button
            className={cn(
              "lift h-9 w-full gap-2 transition-all",
              canPreview && !isBuilding
                ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-[0_4px_16px_-4px_rgba(139,92,246,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_6px_22px_-4px_rgba(139,92,246,0.8),inset_0_1px_0_rgba(255,255,255,0.25)]"
                : "bg-white/[0.04] text-muted-foreground"
            )}
            onClick={onPreview}
            disabled={!canPreview || isBuilding}
          >
            <Play className="size-3.5 fill-current" />
            Open preview
          </Button>
          {!canPreview && (
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Needs name · role · instructions
            </p>
          )}
        </div>

        {/* Export */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Export bundle</SectionHeader>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              { ext: "json", icon: FileJson },
              { ext: "md", icon: FileText },
              { ext: "md", icon: FileText },
            ].map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                <f.icon className="size-2.5" />
                .{f.ext}
              </span>
            ))}
          </div>
          <Button
            variant="outline"
            className="lift h-9 w-full gap-2 border-white/[0.08] bg-white/[0.02] hover:border-primary/35 hover:bg-primary/[0.06] hover:text-primary"
            onClick={handleExport}
            disabled={!canExport || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Preparing
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                Download bundle
              </>
            )}
          </Button>
          {!canExport && (
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Awaiting spec data
            </p>
          )}
        </div>
      </div>
    </HudPanel>
  );
}
