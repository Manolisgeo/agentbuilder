"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BookOpen, Bot, Radio, Search, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BuildStepper } from "@/components/hud/build-stepper";
import { HudPanel } from "@/components/hud/hud-panel";
import { IdleReticle } from "@/components/hud/idle-reticle";
import { getBuildStages } from "@/lib/build-progress";
import {
  agentSpecSchema,
  defaultAgentSpec,
  isAgentSpecEmpty,
  type AgentSpec,
} from "@/lib/agent-spec";

interface AgentGraphProps {
  spec: AgentSpec;
  isBuilding?: boolean;
  buildProgress?: number;
}

type CustomNodeData = {
  label: string;
  subtitle?: string;
  detail?: string;
  icon: "persona" | "instructions" | "tool" | "orchestrator" | "swarm";
  isNew?: boolean;
  animDelay?: number;
};

function GraphNode({ data }: NodeProps<Node<CustomNodeData>>) {
  const icons = {
    persona: Bot,
    instructions: BookOpen,
    tool: Search,
    orchestrator: Users,
    swarm: Users,
  };
  const Icon = icons[data.icon];

  return (
    <div
      className={`group relative min-w-[200px] max-w-[260px] overflow-hidden rounded-lg border border-white/[0.08] bg-surface-3 px-4 py-3 shadow-hud-sm ${
        data.isNew
          ? "agent-node-spawn agent-node-glow cyan-scan-flash border-primary/30"
          : ""
      }`}
      style={
        data.isNew && data.animDelay !== undefined
          ? { animationDelay: `${data.animDelay}ms` }
          : undefined
      }
    >
      {data.icon !== "orchestrator" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!size-1.5 !border !border-surface-3 !bg-system"
        />
      )}

      <div className="relative flex items-start gap-3">
        <div className="rounded-md border border-white/[0.06] bg-surface-2 p-1.5">
          <Icon className="size-3.5 text-primary" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {data.label}
          </p>
          {data.subtitle && (
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {data.subtitle}
            </p>
          )}
          {data.detail && (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {data.detail}
            </p>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-1.5 !border !border-surface-3 !bg-primary"
      />
    </div>
  );
}

const nodeTypes = {
  agentNode: GraphNode,
};

function buildGraphFromSpec(
  spec: AgentSpec,
  seenNodeIds: Set<string>
): { nodes: Node<CustomNodeData>[]; edges: Edge[]; newCount: number } {
  const nodes: Node<CustomNodeData>[] = [];
  const edges: Edge[] = [];
  const hasSwarm = spec.agents && spec.agents.length > 0;
  let newCount = 0;

  const personaId = "persona";
  const personaIsNew = !seenNodeIds.has(personaId);
  if (personaIsNew) newCount++;
  nodes.push({
    id: personaId,
    type: "agentNode",
    position: { x: 300, y: 30 },
    data: {
      label: spec.name || "Untitled Agent",
      subtitle: spec.persona.role || "Define role",
      detail: spec.persona.tone ? `Tone: ${spec.persona.tone}` : undefined,
      icon: hasSwarm ? "orchestrator" : "persona",
      isNew: personaIsNew,
      animDelay: personaIsNew ? 0 : undefined,
    },
  });

  const instructionsId = "instructions";
  if (spec.instructions) {
    const isNew = !seenNodeIds.has(instructionsId);
    if (isNew) newCount++;
    nodes.push({
      id: instructionsId,
      type: "agentNode",
      position: { x: 300, y: 200 },
      data: {
        label: "Instructions",
        detail: spec.instructions,
        icon: "instructions",
        isNew,
        animDelay: isNew ? 120 : undefined,
      },
    });
    edges.push({
      id: "e-persona-instructions",
      source: personaId,
      target: instructionsId,
      animated: !isNew,
      className: isNew ? "edge-draw" : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#ff6b1a" },
      style: { stroke: "rgba(255,107,26,0.5)", strokeWidth: 1.5 },
    });
  }

  spec.tools.forEach((tool, index) => {
    const toolId = `tool-${tool.id}`;
    const isNew = !seenNodeIds.has(toolId);
    if (isNew) newCount++;
    nodes.push({
      id: toolId,
      type: "agentNode",
      position: { x: 60 + index * 220, y: 400 },
      data: {
        label: tool.name,
        subtitle: tool.type.replace("_", " "),
        icon: "tool",
        isNew,
        animDelay: isNew ? 120 + index * 120 : undefined,
      },
    });
    edges.push({
      id: `e-persona-${toolId}`,
      source: personaId,
      target: toolId,
      animated: !isNew,
      className: isNew ? "edge-draw" : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#ff6b1a" },
      style: {
        stroke: "rgba(255,107,26,0.4)",
        strokeWidth: 1.5,
        strokeDasharray: isNew ? 100 : undefined,
      },
    });
  });

  if (hasSwarm && spec.agents) {
    spec.agents.forEach((agent, index) => {
      const agentId = `swarm-${agent.id}`;
      const isNew = !seenNodeIds.has(agentId);
      if (isNew) newCount++;
      nodes.push({
        id: agentId,
        type: "agentNode",
        position: { x: 60 + index * 240, y: 580 },
        data: {
          label: agent.role,
          detail: agent.instructions,
          icon: "swarm",
          isNew,
          animDelay: isNew ? 120 + index * 120 : undefined,
        },
      });

      const edgeTargets =
        agent.dependsOn.length === 0
          ? [{ id: `e-persona-${agentId}`, source: personaId }]
          : agent.dependsOn.map((depId) => ({
              id: `e-${depId}-${agentId}`,
              source: `swarm-${depId}`,
            }));

      edgeTargets.forEach(({ id, source }) => {
        edges.push({
          id,
          source,
          target: agentId,
          animated: !isNew,
          className: isNew ? "edge-draw" : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#ff6b1a" },
        });
      });
    });
  }

  return { nodes, edges, newCount };
}

export function AgentGraph({
  spec,
  isBuilding = false,
  buildProgress = 0,
}: AgentGraphProps) {
  const seenNodeIdsRef = useRef<Set<string>>(new Set());
  const prevSpecKeyRef = useRef("");
  const [pulseKey, setPulseKey] = useState(0);

  const validSpec = useMemo(() => {
    const parsed = agentSpecSchema.safeParse(spec);
    return parsed.success ? parsed.data : defaultAgentSpec;
  }, [spec]);

  const stages = getBuildStages(validSpec);

  const { nodes, edges, newCount } = useMemo(() => {
    const graph = buildGraphFromSpec(validSpec, seenNodeIdsRef.current);
    graph.nodes.forEach((node) => seenNodeIdsRef.current.add(node.id));
    return graph;
  }, [validSpec]);

  useEffect(() => {
    if (isAgentSpecEmpty(validSpec)) {
      seenNodeIdsRef.current.clear();
      prevSpecKeyRef.current = "";
      return;
    }

    const specKey = JSON.stringify(validSpec);
    if (specKey !== prevSpecKeyRef.current) {
      prevSpecKeyRef.current = specKey;
      if (newCount > 0) {
        setPulseKey((key) => key + 1);
      }
    }
  }, [validSpec, newCount]);

  const isEmpty =
    !validSpec.persona.role &&
    !validSpec.instructions &&
    validSpec.tools.length === 0 &&
    !validSpec.agents?.length;

  return (
    <HudPanel tier={2} live className="relative h-full min-h-[420px]">
      {isBuilding && (
        <>
          <div className="pointer-events-none absolute inset-0 z-20 bg-system/[0.02]" />
          <div className="build-scan-line pointer-events-none absolute inset-x-0 z-20 h-20 bg-gradient-to-b from-transparent via-system/[0.06] to-transparent" />
        </>
      )}

      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded border border-white/[0.06] bg-surface-1/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-system backdrop-blur-sm">
          <Radio className="size-3 idle-pulse" strokeWidth={1.5} />
          Live
        </span>
        {!isEmpty && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {validSpec.name}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center p-8">
          <IdleReticle />
          <h3 className="mt-6 text-sm font-medium text-foreground">
            Awaiting agent configuration
          </h3>
          <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
            System online. Describe your agent in the panel to begin assembly.
          </p>
          <BuildStepper stages={stages} />
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-system/60">
            {buildProgress > 0 ? `${buildProgress}% complete` : "Standby"}
          </p>
        </div>
      ) : (
        <div key={pulseKey} className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.35, duration: 400 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1}
              color="rgba(34,211,238,0.12)"
            />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </div>
      )}

      {newCount > 0 && !isEmpty && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded border border-primary/25 bg-surface-1/95 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur-sm">
          +{newCount} module{newCount > 1 ? "s" : ""} deployed
        </div>
      )}
    </HudPanel>
  );
}
