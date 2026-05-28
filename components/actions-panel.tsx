"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { downloadAgentBundle } from "@/lib/export";
import { isAgentSpecEmpty, type AgentSpec } from "@/lib/agent-spec";

interface ActionsPanelProps {
  agentSpec: AgentSpec;
  errorMessage: string | null;
  onClearError: () => void;
}

export function ActionsPanel({
  agentSpec,
  errorMessage,
  onClearError,
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
    <div className="flex h-full flex-col border-l bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Actions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Export your agent as a downloadable bundle.
        </p>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {(errorMessage || exportError) && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage || exportError}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agent snapshot</CardTitle>
            <CardDescription>
              Current spec fields from the live build.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Name
              </p>
              <p className="font-medium">{agentSpec.name}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Role
              </p>
              <p>{agentSpec.persona.role || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tone
              </p>
              <p>{agentSpec.persona.tone || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tools
              </p>
              <p>
                {agentSpec.tools.length > 0
                  ? agentSpec.tools.map((t) => t.name).join(", ")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Instructions
              </p>
              <p className="line-clamp-4 text-muted-foreground">
                {agentSpec.instructions || "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Export bundle</CardTitle>
            <CardDescription>
              Downloads a zip with agent.json, agent.md, and README.md.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={handleExport}
              disabled={!canExport || isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Download bundle
                </>
              )}
            </Button>
            {!canExport && (
              <p className="mt-2 text-xs text-muted-foreground">
                Chat with the builder first to populate your agent spec.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
