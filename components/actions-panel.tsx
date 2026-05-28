"use client";

import {
  Download,
  ExternalLink,
  Loader2,
  Palette,
  Play,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeploymentCodePanel } from "@/components/design/deployment-code-panel";
import { StyleConfigPanel } from "@/components/design/style-config-panel";
import { HudError } from "@/components/hud/hud-error";
import { HudPanel } from "@/components/hud/hud-panel";
import { SegmentedProgress } from "@/components/hud/segmented-progress";
import { MemoryPanel } from "@/components/memory-panel";
import { downloadAgentBundle } from "@/lib/export";
import { isAgentPreviewReady } from "@/lib/agent-prompt";
import { hasAgentFrontend } from "@/lib/deploy-html";
import {
  defaultAgentSpec,
  isAgentSpecEmpty,
  normalizeAgentSpec,
  type AgentSpec,
} from "@/lib/agent-spec";
import { planConnectors, type SlotInput } from "@/lib/connectors";
import { inferVoiceFromSpec } from "@/lib/voice";
import { resolveAgentUi } from "@/lib/agent-ui";
import { saveAgent, type StoredAgent } from "@/lib/agent-storage";
import { cn } from "@/lib/utils";
import type { SwarmMemoryState } from "@/lib/swarm-memory";

interface ActionsPanelProps {
  agentSpec: AgentSpec;
  agentId?: string;
  errorMessage: string | null;
  onClearError: () => void;
  onAgentSaved?: (agent: StoredAgent) => void;
  buildProgress?: number;
  statusLabel?: string;
  isBuilding?: boolean;
  onPreview?: () => void;
  onDesign?: () => void;
  onSpecUpdate?: (spec: AgentSpec) => void;
  memoryState?: SwarmMemoryState;
  lastWrittenBy?: Record<string, string>;
  latestWrittenKeys?: Set<string>;
}

function SpecRow({ label, value }: { label: string; value: string }) {
  const filled = Boolean(value);
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>
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
    <div className="mb-3 border-b border-border/50 pb-1.5">
      <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{children}</p>
    </div>
  );
}

export function ActionsPanel({
  agentSpec,
  agentId,
  errorMessage,
  onClearError,
  onAgentSaved,
  buildProgress = 0,
  statusLabel = "AWAITING INPUT",
  isBuilding = false,
  onPreview,
  onDesign,
  onSpecUpdate,
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
  const hasFrontend = hasAgentFrontend(agentSpec);
  const ui = resolveAgentUi(agentSpec.ui);

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const stored = saveAgent(agentSpec, agentId);
      onAgentSaved?.(stored);

      await fetch("/api/save-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentSpec),
      });

      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  const plan = useMemo(() => planConnectors(agentSpec), [agentSpec]);
  const voiceAgent = useMemo(() => inferVoiceFromSpec(agentSpec), [agentSpec]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [slotInputs, setSlotInputs] = useState<Record<string, SlotInput>>({});
  const [searchKey, setSearchKey] = useState("");
  const [target, setTarget] = useState<"local" | "railway">("local");
  const [prepared, setPrepared] = useState<{
    dir: string;
    command: string;
    env: Record<string, string>;
  } | null>(null);
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
    setPrepared(null);
    onClearError();
    try {
      const resp = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec: normalizeAgentSpec(agentSpec, defaultAgentSpec),
          target,
          runtime: {
            slots: slotInputs,
            searchApiKey: searchKey.trim() || undefined,
          },
        }),
      });
      if (!resp.ok || !resp.body) {
        const msg = await resp.json().catch(() => ({}));
        const detail =
          typeof msg.error === "string"
            ? msg.error
            : resp.status === 500
              ? "Deploy failed on the server. Restart the dev server and try again."
              : `Deploy failed (${resp.status}).`;
        throw new Error(detail);
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
            dir?: string;
            command?: string;
            env?: Record<string, string>;
          };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "log" && evt.line) {
            setDeployLogs((prev) => [...prev, evt.line as string]);
          } else if (evt.type === "prepared" && evt.command && evt.dir) {
            setPrepared({
              dir: evt.dir,
              command: evt.command,
              env: evt.env ?? {},
            });
          } else if (evt.type === "done" && evt.url) {
            setDeployedUrl(evt.url);
            refreshDeployments();
          } else if (evt.type === "error") {
            setDeployError(evt.message ?? "Deploy failed.");
          }
        }
      }
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : "Deploy failed.");
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <HudPanel tier={1} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">Agent Status</h2>
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-success/40" />
          <span className="relative size-2 rounded-full bg-success/70 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
        </span>
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

        {/* Agent details */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Your Agent</SectionHeader>
          <div className="divide-y divide-white/[0.04]">
            <SpecRow label="Name" value={agentSpec.name === "Untitled Agent" ? "" : agentSpec.name} />
            <SpecRow label="Role" value={agentSpec.persona.role} />
            <SpecRow label="Personality" value={agentSpec.persona.tone} />
            <SpecRow
              label="Capabilities"
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
            <SpecRow label="Design" value={ui.template} />
            <SpecRow label="Deploy target" value={agentSpec.deployment?.platform ?? "html"} />
          </div>
        </div>

        {agentSpec.swarmMemory && agentSpec.swarmMemory.length > 0 && (
          <MemoryPanel
            keys={agentSpec.swarmMemory}
            state={memoryState}
            lastWrittenBy={lastWrittenBy}
            latestWrittenKeys={latestWrittenKeys}
          />
        )}

        {onSpecUpdate && (
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
            <SectionHeader>Design</SectionHeader>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
              Choose how your agent&apos;s interface looks. You can describe it in chat or tweak it below.
            </p>
            <StyleConfigPanel agentSpec={agentSpec} onSpecUpdate={onSpecUpdate} />
            <div className="mt-4 border-t border-white/[0.05] pt-4">
              <DeploymentCodePanel
                agentSpec={agentSpec}
                onSpecUpdate={onSpecUpdate}
              />
            </div>
            <Button
              className="lift mt-3 h-9 w-full gap-2 border border-system/30 bg-system/10 text-system hover:bg-system/15"
              variant="outline"
              onClick={onDesign}
            >
              <Palette className="size-3.5" />
              Open design preview
            </Button>
          </div>
        )}

        {/* Preview */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Try It Out</SectionHeader>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
            See how your agent will look and feel before going live.
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
            <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
              Add a name, role, and instructions to unlock preview
            </p>
          )}
        </div>

        {/* Save agent */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Save</SectionHeader>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Save your agent to come back to it later.
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
          <SectionHeader>Download</SectionHeader>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Download a complete package you can run or share.
          </p>
          <Button
            variant="outline"
            className="lift h-9 w-full gap-2 border-white/[0.08] bg-white/[0.02] hover:border-primary/35 hover:bg-primary/[0.06] hover:text-primary"
            onClick={handleExport}
            disabled={!canExport || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                Download files
              </>
            )}
          </Button>
          {!canExport && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
              Finish building your agent to download
            </p>
          )}
        </div>

        {/* Go Live */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
          <SectionHeader>Go Live</SectionHeader>
          <div className="mb-3 flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
            {(["local", "railway"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                disabled={isDeploying}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                  target === t
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "local" ? "Run locally" : "Cloud deploy"}
              </button>
            ))}
          </div>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
            {target === "local"
              ? "Run your agent on this computer."
              : "Deploy to Railway in one click — returns a public live URL."}
          </p>

          {(plan.length > 0 || voiceAgent) && (
            <div className="mb-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
              <p className="text-[11px] text-muted-foreground/70">
                Uses your saved account connections:
              </p>
              <div className="mt-1.5 space-y-0.5">
                {plan.map((c) => (
                  <p key={c.slot} className="text-[11.5px] text-foreground/70">
                    · {c.name}
                  </p>
                ))}
                {voiceAgent && (
                  <p className="font-mono text-[10px] text-foreground/60">
                    · ElevenLabs voice (ELEVENLABS_API_KEY)
                  </p>
                )}
              </div>
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
                {target === "railway" ? "Preparing…" : "Deploying…"}
              </>
            ) : (
              <>
                <Rocket className="size-3.5" />
                {target === "railway" ? "Prepare for cloud" : "Run locally"}
              </>
            )}
          </Button>

          {prepared && (
            <div className="mt-2 space-y-2 rounded-md border border-success/25 bg-success/[0.05] p-2.5">
              <p className="text-[12px] font-medium text-foreground/90">Ready to deploy</p>
              <p className="text-[11.5px] text-muted-foreground">
                Your agent package is ready. Open a terminal in{" "}
                <span className="rounded bg-black/20 px-1 py-0.5 font-mono text-[10px]">{prepared.dir}</span>{" "}
                and run the command below to go live.
              </p>
              <pre className="overflow-auto rounded bg-black/30 p-2 font-mono text-[10px] text-success/90">
                {prepared.command}
              </pre>
              <p className="text-[11.5px] text-muted-foreground">
                You&apos;ll also need to add your account credentials in the Railway dashboard.
              </p>
            </div>
          )}

          {deployedUrl && (
            <a
              href={deployedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-md border border-success/30 bg-success/[0.06] px-3 py-2 text-[12px] text-success transition-colors hover:bg-success/[0.12]"
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
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-[11px] text-muted-foreground/70 hover:text-muted-foreground">
                {isDeploying ? "Deploying… see details" : "Deployment log"}
              </summary>
              <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/[0.06] bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {deployLogs.join("\n")}
              </pre>
            </details>
          )}

          {!canExport && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
              Complete your agent setup to go live
            </p>
          )}
        </div>

        {deployments.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
            <SectionHeader>Live Agents</SectionHeader>
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
                      <p className="truncate text-[11px] text-muted-foreground">
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
