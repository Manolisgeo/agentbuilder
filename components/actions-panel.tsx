"use client";

import {
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Loader2,
  Play,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import { SegmentedProgress } from "@/components/hud/segmented-progress";
import { MemoryPanel } from "@/components/memory-panel";
import { downloadAgentBundle } from "@/lib/export";
import { isAgentPreviewReady } from "@/lib/agent-prompt";
import { isAgentSpecEmpty, type AgentSpec } from "@/lib/agent-spec";
import {
  NEED_LABELS,
  needIsSecret,
  planConnectors,
  type ConnectorSlot,
  type RuntimeNeed,
  type SlotInput,
} from "@/lib/connectors";
import { cn } from "@/lib/utils";
import type { SwarmMemoryState } from "@/lib/swarm-memory";

interface ActionsPanelProps {
  agentSpec: AgentSpec;
  errorMessage: string | null;
  onClearError: () => void;
  buildProgress?: number;
  statusLabel?: string;
  isBuilding?: boolean;
  onPreview?: () => void;
  memoryState?: SwarmMemoryState;
  lastWrittenBy?: Record<string, string>;
  latestWrittenKeys?: Set<string>;
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
  memoryState = {},
  lastWrittenBy = {},
  latestWrittenKeys,
}: ActionsPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const canExport = !isAgentSpecEmpty(agentSpec);
  const canPreview = isAgentPreviewReady(agentSpec);

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/save-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentSpec),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  const plan = useMemo(() => planConnectors(agentSpec), [agentSpec]);
  const hasWebSearch = plan.some((c) => c.type === "web_search");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [slotInputs, setSlotInputs] = useState<Record<string, SlotInput>>({});
  const [searchKey, setSearchKey] = useState("");
  const [deployments, setDeployments] = useState<
    { name: string; url: string | null; status: string }[]
  >([]);

  const refreshDeployments = useCallback(async () => {
    try {
      const r = await fetch("/api/deploy");
      const d = await r.json();
      setDeployments(d.deployments ?? []);
    } catch {
      // docker may be down; leave list empty
    }
  }, []);

  useEffect(() => {
    refreshDeployments();
  }, [refreshDeployments]);

  async function stopDeployment(name: string) {
    await fetch(`/api/deploy?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    }).catch(() => undefined);
    refreshDeployments();
  }

  function slotValue(c: ConnectorSlot, need: RuntimeNeed): string {
    const entered = slotInputs[c.slot]?.[need];
    if (entered !== undefined) return entered;
    if (need === "path") return c.path ?? "";
    if (need === "glob") return c.glob ?? "";
    if (need === "baseUrl") return c.baseUrl ?? "";
    return "";
  }

  function setSlotField(slot: string, need: RuntimeNeed, value: string) {
    setSlotInputs((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], [need]: value },
    }));
  }

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

  async function handleDeploy() {
    setIsDeploying(true);
    setDeployLogs([]);
    setDeployedUrl(null);
    setDeployError(null);
    onClearError();
    try {
      const resp = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec: agentSpec,
          runtime: {
            slots: slotInputs,
            searchApiKey: searchKey.trim() || undefined,
          },
        }),
      });
      if (!resp.ok || !resp.body) {
        const msg = await resp.json().catch(() => ({}));
        throw new Error(msg.error || `Deploy failed (${resp.status}).`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: {
            type: string;
            line?: string;
            url?: string;
            message?: string;
          };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "log" && evt.line) {
            setDeployLogs((prev) => [...prev, evt.line as string]);
          } else if (evt.type === "done" && evt.url) {
            setDeployedUrl(evt.url);
          } else if (evt.type === "error") {
            setDeployError(evt.message ?? "Deploy failed.");
          }
        }
      }
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : "Deploy failed.");
    } finally {
      setIsDeploying(false);
      refreshDeployments();
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

        {/* Shared Memory */}
        {agentSpec.swarmMemory && agentSpec.swarmMemory.length > 0 && (
          <MemoryPanel
            keys={agentSpec.swarmMemory}
            state={memoryState}
            lastWrittenBy={lastWrittenBy}
            latestWrittenKeys={latestWrittenKeys}
          />
        )}

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

        {/* Save agent */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Save agent</SectionHeader>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Persist spec to disk for the local scheduler and OAuth flow.
          </p>
          <Button
            variant="outline"
            className={cn(
              "lift h-9 w-full gap-2 border-white/[0.08] bg-white/[0.02] transition-all",
              saveStatus === "saved" && "border-emerald-500/40 text-emerald-400",
              saveStatus === "error" && "border-red-500/40 text-red-400",
              saveStatus === "idle" && "hover:border-primary/35 hover:bg-primary/[0.06] hover:text-primary"
            )}
            onClick={handleSave}
            disabled={!canExport || isSaving}
          >
            {isSaving ? (
              <><Loader2 className="size-3.5 animate-spin" />Saving</>
            ) : saveStatus === "saved" ? (
              <><Save className="size-3.5" />Saved</>
            ) : saveStatus === "error" ? (
              <><Save className="size-3.5" />Save failed</>
            ) : (
              <><Save className="size-3.5" />Save agent</>
            )}
          </Button>
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

        {/* Deploy */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Deploy · local Docker</SectionHeader>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Generate a runnable agent and launch it in a container.
          </p>

          {(plan.some((c) => c.needs.length > 0) || hasWebSearch) && (
            <div className="mb-3 space-y-3">
              {plan
                .filter((c) => c.needs.length > 0)
                .map((c) => (
                  <div key={c.slot} className="space-y-1.5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-system">
                      {c.name}
                    </p>
                    {c.needs.map((need) => (
                      <Input
                        key={need}
                        type={needIsSecret(need) ? "password" : "text"}
                        placeholder={NEED_LABELS[need]}
                        value={slotValue(c, need)}
                        onChange={(e) => setSlotField(c.slot, need, e.target.value)}
                        disabled={isDeploying}
                        className="h-8 border-white/[0.08] bg-white/[0.02] text-[12px]"
                      />
                    ))}
                  </div>
                ))}
              {hasWebSearch && (
                <Input
                  type="password"
                  placeholder="Web search API key (optional)"
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  disabled={isDeploying}
                  className="h-8 border-white/[0.08] bg-white/[0.02] text-[12px]"
                />
              )}
            </div>
          )}

          <Button
            className={cn(
              "lift h-9 w-full gap-2 transition-all",
              canExport && !isDeploying
                ? "bg-gradient-to-br from-primary to-orange-600 text-primary-foreground shadow-[0_4px_16px_-4px_rgba(255,107,26,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_6px_22px_-4px_rgba(255,107,26,0.8),inset_0_1px_0_rgba(255,255,255,0.25)]"
                : "bg-white/[0.04] text-muted-foreground"
            )}
            onClick={handleDeploy}
            disabled={!canExport || isDeploying}
          >
            {isDeploying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Deploying
              </>
            ) : (
              <>
                <Rocket className="size-3.5" />
                Deploy locally
              </>
            )}
          </Button>

          {deployedUrl && (
            <a
              href={deployedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-md border border-system/30 bg-system/[0.06] px-3 py-2 text-[12px] text-system transition-colors hover:bg-system/[0.12]"
            >
              <ExternalLink className="size-3.5" />
              {deployedUrl}
            </a>
          )}

          {deployError && (
            <div className="mt-2">
              <HudError message={deployError} />
            </div>
          )}

          {deployLogs.length > 0 && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/[0.06] bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {deployLogs.join("\n")}
            </pre>
          )}

          {!canExport && (
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Build an agent first
            </p>
          )}
        </div>

        {/* Deployments */}
        {deployments.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
            <SectionHeader>Deployments</SectionHeader>
            <div className="space-y-2">
              {deployments.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-foreground/90">
                      {d.name.replace(/^agent-/, "")}
                    </p>
                    {d.url && (
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {d.url}
                      </p>
                    )}
                  </div>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-system transition-colors hover:bg-system/[0.12]"
                      title="Open"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => stopDeployment(d.name)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/[0.12] hover:text-red-400"
                    title="Stop"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </HudPanel>
  );
}
