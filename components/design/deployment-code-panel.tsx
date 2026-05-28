"use client";

import { Check, Copy, FileCode, Pencil, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { updateDeploymentFiles } from "@/lib/agent-mutations";
import { getPlatformLabel, getSyntaxLanguage } from "@/lib/agent-ui";
import { syncDeployment } from "@/lib/deployment-templates";
import type { AgentSpec } from "@/lib/agent-spec";

interface DeploymentCodePanelProps {
  agentSpec: AgentSpec;
  onSpecUpdate?: (spec: AgentSpec) => void;
}

export function DeploymentCodePanel({
  agentSpec,
  onSpecUpdate,
}: DeploymentCodePanelProps) {
  const deployment = useMemo(
    () => syncDeployment(agentSpec),
    [agentSpec]
  );
  const files = deployment.files;
  const [activeFile, setActiveFile] = useState(files[0]?.path ?? "");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const currentFile =
    files.find((f) => f.path === activeFile) ?? files[0] ?? null;

  useEffect(() => {
    if (!files.some((f) => f.path === activeFile)) {
      setActiveFile(files[0]?.path ?? "");
    }
  }, [files, activeFile]);

  useEffect(() => {
    setEditing(false);
    setDraft(currentFile?.content ?? "");
  }, [currentFile?.path, currentFile?.content]);

  const isEditable =
    currentFile?.path === "custom.css" ||
    currentFile?.path === "index.html" ||
    currentFile?.path === "theme.css";

  async function handleCopy() {
    if (!currentFile) return;
    await navigator.clipboard.writeText(
      editing ? draft : currentFile.content
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSave() {
    if (!currentFile || !onSpecUpdate) return;
    const nextFiles = files.map((file) =>
      file.path === currentFile.path ? { ...file, content: draft } : file
    );
    onSpecUpdate(updateDeploymentFiles(agentSpec, nextFiles));
    setEditing(false);
  }

  function handleResetFile() {
    if (!currentFile) return;
    setDraft(currentFile.content);
  }

  if (files.length === 0) {
    return (
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        No deployment files yet. Ask the chat to design your frontend, or select
        a client SDK platform above.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode className="size-3.5 text-system" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {getPlatformLabel(deployment.platform)} · {files.length} file
            {files.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onSpecUpdate && isEditable && (
            <>
              {editing ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFile}
                    className="h-7 gap-1 text-xs text-muted-foreground"
                  >
                    <RotateCcw className="size-3" />
                    Reset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    className="h-7 gap-1 text-xs"
                  >
                    <Check className="size-3" />
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(currentFile?.content ?? "");
                    setEditing(true);
                  }}
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3" />
                  Edit
                </Button>
              )}
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!currentFile}
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="size-3 text-green-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {files.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => setActiveFile(file.path)}
              className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${
                currentFile?.path === file.path
                  ? "border-system/40 bg-system/10 text-system"
                  : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:text-foreground"
              }`}
            >
              {file.path}
            </button>
          ))}
        </div>
      )}

      {currentFile?.path === "custom.css" && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Edit custom.css to fine-tune styling. Changes apply to Design preview
          and local deployment instantly after saving.
        </p>
      )}

      {currentFile && editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="min-h-[220px] w-full resize-y rounded-lg border border-system/30 bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-system/50"
        />
      ) : (
        currentFile && (
          <div className="overflow-hidden rounded-lg border border-white/[0.06]">
            <SyntaxHighlighter
              language={getSyntaxLanguage(currentFile.language)}
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: "12px",
                fontSize: "11px",
                lineHeight: "1.5",
                background: "rgba(0,0,0,0.35)",
                maxHeight: "220px",
              }}
              showLineNumbers
            >
              {currentFile.content}
            </SyntaxHighlighter>
          </div>
        )
      )}
    </div>
  );
}
