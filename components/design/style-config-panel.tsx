"use client";

import { updateAgentUi, updateDeploymentPlatform } from "@/lib/agent-mutations";
import {
  deploymentPlatformSchema,
  type AgentUi,
  type DeploymentPlatform,
} from "@/lib/agent-ui";
import type { AgentSpec } from "@/lib/agent-spec";

interface StyleConfigPanelProps {
  agentSpec: AgentSpec;
  onSpecUpdate: (spec: AgentSpec) => void;
}

const TEMPLATES: AgentUi["template"][] = ["chat", "widget", "landing"];
const LAYOUTS: AgentUi["layout"][] = ["sidebar", "fullscreen", "embedded"];
const MODES: AgentUi["theme"]["mode"][] = ["light", "dark", "auto"];
const FONTS: AgentUi["theme"]["fontFamily"][] = ["sans", "serif", "mono"];
const RADII: AgentUi["theme"]["borderRadius"][] = ["none", "md", "full"];
const PLATFORMS = deploymentPlatformSchema.options;

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              value === option
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12] hover:text-foreground"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StyleConfigPanel({
  agentSpec,
  onSpecUpdate,
}: StyleConfigPanelProps) {
  const ui = agentSpec.ui!;
  const theme = ui.theme;

  function patchUi(
    patch: Partial<AgentUi> & { theme?: Partial<AgentUi["theme"]> }
  ) {
    onSpecUpdate(updateAgentUi(agentSpec, patch));
  }

  function setPlatform(platform: DeploymentPlatform) {
    onSpecUpdate(updateDeploymentPlatform(agentSpec, platform));
  }

  return (
    <div className="space-y-4">
      <OptionGroup
        label="Template"
        value={ui.template}
        options={TEMPLATES}
        onChange={(template) => patchUi({ template })}
      />

      <OptionGroup
        label="Layout"
        value={ui.layout}
        options={LAYOUTS}
        onChange={(layout) => patchUi({ layout })}
      />

      <OptionGroup
        label="Theme mode"
        value={theme.mode}
        options={MODES}
        onChange={(mode) => patchUi({ theme: { ...theme, mode } })}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="primary-color"
            className="mb-2 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Primary
          </label>
          <div className="flex items-center gap-2">
            <input
              id="primary-color"
              type="color"
              value={theme.primaryColor}
              onChange={(e) =>
                patchUi({ theme: { ...theme, primaryColor: e.target.value } })
              }
              className="size-8 cursor-pointer rounded-md border border-white/[0.08] bg-transparent"
            />
            <input
              type="text"
              value={theme.primaryColor}
              onChange={(e) =>
                patchUi({ theme: { ...theme, primaryColor: e.target.value } })
              }
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-foreground"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="accent-color"
            className="mb-2 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Accent
          </label>
          <div className="flex items-center gap-2">
            <input
              id="accent-color"
              type="color"
              value={theme.accentColor ?? theme.primaryColor}
              onChange={(e) =>
                patchUi({ theme: { ...theme, accentColor: e.target.value } })
              }
              className="size-8 cursor-pointer rounded-md border border-white/[0.08] bg-transparent"
            />
            <input
              type="text"
              value={theme.accentColor ?? theme.primaryColor}
              onChange={(e) =>
                patchUi({ theme: { ...theme, accentColor: e.target.value } })
              }
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-foreground"
            />
          </div>
        </div>
      </div>

      <OptionGroup
        label="Font"
        value={theme.fontFamily}
        options={FONTS}
        onChange={(fontFamily) => patchUi({ theme: { ...theme, fontFamily } })}
      />

      <OptionGroup
        label="Border radius"
        value={theme.borderRadius}
        options={RADII}
        onChange={(borderRadius) =>
          patchUi({ theme: { ...theme, borderRadius } })
        }
      />

      <div>
        <label
          htmlFor="welcome-message"
          className="mb-2 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Welcome message
        </label>
        <textarea
          id="welcome-message"
          value={ui.welcomeMessage ?? ""}
          onChange={(e) => patchUi({ welcomeMessage: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/30"
        />
      </div>

      <OptionGroup
        label="Deployment platform"
        value={agentSpec.deployment?.platform ?? "html"}
        options={PLATFORMS}
        onChange={setPlatform}
      />
    </div>
  );
}
