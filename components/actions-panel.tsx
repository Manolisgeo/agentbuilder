"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import { SegmentedProgress } from "@/components/hud/segmented-progress";
import { downloadAgentBundle } from "@/lib/export";
import { isAgentSpecEmpty, type AgentSpec } from "@/lib/agent-spec";

interface ActionsPanelProps {
  agentSpec: AgentSpec;
  errorMessage: string | null;
  onClearError: () => void;
  buildProgress?: number;
  statusLabel?: string;
  isBuilding?: boolean;
}

function SpecField({ label, value }: { label: string; value: string }) {
  const filled = Boolean(value);
  return (
    <div>
      <p className="hud-label">{label}</p>
      <p
        className={`mt-0.5 text-sm ${filled ? "text-foreground" : "text-muted-foreground/50"}`}
      >
        {value || "—"}
      </p>
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
}: ActionsPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const canExport = !isAgentSpecEmpty(agentSpec);

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
    <HudPanel tier={1} className="flex h-full min-h-[420px] flex-col">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="hud-label">Telemetry</p>
        <h2 className="mt-0.5 text-sm font-medium">Actions</h2>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {(errorMessage || exportError) && (
          <HudError message={errorMessage || exportError || ""} />
        )}

        <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 p-3">
          <SegmentedProgress
            value={buildProgress}
            statusLabel={isBuilding ? "ASSEMBLING AGENT" : statusLabel}
          />
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 p-3">
          <p className="hud-label mb-3">Agent snapshot</p>
          <div className="space-y-3">
            <SpecField label="Name" value={agentSpec.name} />
            <div className="h-px bg-white/[0.06]" />
            <SpecField label="Role" value={agentSpec.persona.role} />
            <SpecField label="Tone" value={agentSpec.persona.tone} />
            <SpecField
              label="Tools"
              value={
                agentSpec.tools.length > 0
                  ? agentSpec.tools.map((t) => t.name).join(", ")
                  : ""
              }
            />
            <SpecField label="Instructions" value={agentSpec.instructions} />
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-surface-2/50 p-3">
          <p className="hud-label mb-1">Export bundle</p>
          <p className="mb-3 text-xs text-muted-foreground">
            agent.json · agent.md · README.md
          </p>
          <Button
            variant="outline"
            className="w-full border-white/[0.08] bg-transparent hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary"
            onClick={handleExport}
            disabled={!canExport || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Preparing
              </>
            ) : (
              <>
                <Download className="size-4" />
                Download bundle
              </>
            )}
          </Button>
          {!canExport && (
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Awaiting spec data
            </p>
          )}
        </div>
      </div>
    </HudPanel>
  );
}
