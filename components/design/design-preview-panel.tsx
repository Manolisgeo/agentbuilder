"use client";

import { Palette } from "lucide-react";
import { useMemo } from "react";
import { HudPanel } from "@/components/hud/hud-panel";
import { buildDeployHtml, getDeployCustomCss } from "@/lib/deploy-html";
import { getPlatformLabel, resolveAgentUi } from "@/lib/agent-ui";
import type { AgentSpec } from "@/lib/agent-spec";

interface DesignPreviewPanelProps {
  agentSpec: AgentSpec;
}

export function DesignPreviewPanel({ agentSpec }: DesignPreviewPanelProps) {
  const ui = resolveAgentUi(agentSpec.ui);
  const platform = agentSpec.deployment?.platform ?? "html";

  const previewHtml = useMemo(() => {
    const savedHtml = agentSpec.deployment?.files.find(
      (file) => file.path === "index.html"
    )?.content;
    if (savedHtml) return savedHtml;
    return buildDeployHtml(agentSpec, {
      mode: "static",
      customCss: getDeployCustomCss(agentSpec),
    });
  }, [agentSpec]);

  return (
    <HudPanel
      tier={2}
      glow="cyan"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Palette className="size-4 text-system" strokeWidth={1.75} />
          <div>
            <p className="hud-label leading-none">Design preview</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Pixel-perfect match with local deployment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {ui.layout}
          </span>
          <span className="rounded-full border border-system/30 bg-system/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-system">
            {getPlatformLabel(platform)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-b-xl bg-[#07060a]">
        <iframe
          title={`${agentSpec.name} design preview`}
          srcDoc={previewHtml}
          className="h-full w-full border-0"
          sandbox=""
        />
      </div>
    </HudPanel>
  );
}
