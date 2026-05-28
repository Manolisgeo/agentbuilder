"use client";

import { MessageSquare, Sparkles } from "lucide-react";
import { updateDeploymentPlatform } from "@/lib/agent-mutations";
import {
  deploymentPlatformSchema,
  type DeploymentPlatform,
} from "@/lib/agent-ui";
import type { AgentSpec } from "@/lib/agent-spec";

interface StyleConfigPanelProps {
  agentSpec: AgentSpec;
  onSpecUpdate: (spec: AgentSpec) => void;
}

const PLATFORMS = deploymentPlatformSchema.options;

export function StyleConfigPanel({
  agentSpec,
  onSpecUpdate,
}: StyleConfigPanelProps) {
  const hasFrontend = Boolean(
    agentSpec.deployment?.files.find((f) => f.path === "index.html")?.content
  );

  function setPlatform(platform: DeploymentPlatform) {
    onSpecUpdate(updateDeploymentPlatform(agentSpec, platform));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-system/20 bg-system/[0.04] p-3.5">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-system" />
          <div>
            <p className="text-[12px] font-medium text-foreground">
              Chat-driven design
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Each agent gets a unique frontend generated from scratch. Tell
              the chat what you want — e.g. &ldquo;Make it a dark minimal
              dashboard for a finance agent&rdquo; or &ldquo;Redesign with a
              warm, friendly landing page feel.&rdquo; Keep chatting to refine
              it anytime.
            </p>
            {hasFrontend ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-system">
                Frontend generated
              </p>
            ) : (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                No frontend yet — ask chat to design it
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Example prompts
        </p>
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <MessageSquare className="mt-0.5 size-3 shrink-0 opacity-50" />
            &ldquo;Design a sleek dark UI with emerald accents for a coding
            assistant&rdquo;
          </li>
          <li className="flex gap-2">
            <MessageSquare className="mt-0.5 size-3 shrink-0 opacity-50" />
            &ldquo;Make the welcome area feel like a luxury hotel concierge&rdquo;
          </li>
          <li className="flex gap-2">
            <MessageSquare className="mt-0.5 size-3 shrink-0 opacity-50" />
            &ldquo;Change to a light, playful design with rounded bubbles&rdquo;
          </li>
        </ul>
      </div>

      <div>
        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Client SDK platform
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => setPlatform(platform)}
              className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                (agentSpec.deployment?.platform ?? "html") === platform
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12] hover:text-foreground"
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
