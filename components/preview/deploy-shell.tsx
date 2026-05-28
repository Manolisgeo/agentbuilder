"use client";

import { Bot } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";
import { resolveAgentUi, themeToCssVariables } from "@/lib/agent-ui";
import type { AgentSpec } from "@/lib/agent-spec";
import { cn } from "@/lib/utils";

interface DeployShellProps {
  agentSpec: AgentSpec;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  showBrowserChrome?: boolean;
  variant?: "preview" | "design";
}

export function DeployShell({
  agentSpec,
  children,
  footer,
  className,
  showBrowserChrome = true,
  variant = "preview",
}: DeployShellProps) {
  const ui = resolveAgentUi(agentSpec.ui);
  const themeVars = themeToCssVariables(ui.theme);
  const slug = agentSpec.name.toLowerCase().replace(/\s+/g, "-");

  const maxWidth =
    ui.layout === "embedded"
      ? "max-w-[420px]"
      : ui.layout === "sidebar"
        ? "max-w-[880px]"
        : "max-w-[720px]";

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-xl", className)}
      style={themeVars}
    >
      {showBrowserChrome && (
        <div
          className="shrink-0 border-b px-4 py-2"
          style={{
            borderColor: "color-mix(in srgb, var(--agent-text) 6%, transparent)",
            background: "color-mix(in srgb, var(--agent-bg) 80%, black)",
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-red-500/60" />
              <span className="size-2.5 rounded-full bg-yellow-500/60" />
              <span className="size-2.5 rounded-full bg-green-500/60" />
            </div>
            <div className="ml-2 flex flex-1 items-center justify-center">
              <div
                className="flex items-center gap-1.5 rounded-md px-2.5 py-0.5 font-mono text-[10px]"
                style={{
                  background: "color-mix(in srgb, var(--agent-text) 4%, transparent)",
                  color: "var(--agent-muted)",
                }}
              >
                <span
                  className="size-1 rounded-full"
                  style={{
                    background: "var(--agent-primary)",
                    boxShadow: "0 0 6px color-mix(in srgb, var(--agent-primary) 80%, transparent)",
                  }}
                />
                deploy://{slug}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          background: "var(--agent-bg)",
          color: "var(--agent-text)",
          fontFamily: "var(--agent-font)",
        }}
      >
        <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-4">
          <div
            className={cn(
              "flex min-h-0 w-full flex-col overflow-hidden",
              maxWidth,
              ui.template === "widget" && "my-auto",
              ui.template === "landing" && "my-auto"
            )}
            style={{
              background: "var(--agent-surface)",
              borderRadius: "var(--agent-radius)",
              border: "1px solid color-mix(in srgb, var(--agent-text) 8%, transparent)",
              boxShadow:
                variant === "design"
                  ? "0 24px 48px -12px rgba(0,0,0,0.35)"
                  : "0 16px 40px -12px rgba(0,0,0,0.3)",
            }}
          >
            <header
              className="shrink-0 px-5 py-4"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--agent-primary) 16%, transparent), transparent)",
                borderBottom:
                  "1px solid color-mix(in srgb, var(--agent-text) 6%, transparent)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center"
                  style={{
                    borderRadius: "var(--agent-radius-sm)",
                    border:
                      "1px solid color-mix(in srgb, var(--agent-primary) 35%, transparent)",
                    background:
                      "linear-gradient(135deg, color-mix(in srgb, var(--agent-primary) 25%, transparent), color-mix(in srgb, var(--agent-primary) 8%, transparent))",
                  }}
                >
                  <Bot
                    className="size-5"
                    style={{ color: "var(--agent-accent)" }}
                    strokeWidth={1.75}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] font-semibold">{agentSpec.name}</h2>
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
                      style={{
                        border:
                          "1px solid color-mix(in srgb, var(--agent-primary) 35%, transparent)",
                        background:
                          "color-mix(in srgb, var(--agent-primary) 12%, transparent)",
                        color: "var(--agent-accent)",
                      }}
                    >
                      {ui.template}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 text-[12px]"
                    style={{ color: "var(--agent-muted)" }}
                  >
                    {agentSpec.persona.role || "AI Assistant"}
                  </p>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

            {footer && (
              <footer
                className="shrink-0 border-t"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--agent-text) 6%, transparent)",
                }}
              >
                {footer}
              </footer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function themedButtonStyle(): CSSProperties {
  return {
    borderRadius: "var(--agent-radius-sm)",
    border: "1px solid color-mix(in srgb, var(--agent-text) 8%, transparent)",
    background: "transparent",
    color: "var(--agent-muted)",
  };
}

export function themedPrimaryButtonStyle(): CSSProperties {
  return {
    borderRadius: "var(--agent-radius-sm)",
    border: "none",
    background: "var(--agent-primary)",
    color: "#ffffff",
    fontWeight: 500,
  };
}
