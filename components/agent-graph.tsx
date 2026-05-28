"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardNode, type BoardNodeData } from "@/components/board/board-node";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { HudPanel } from "@/components/hud/hud-panel";
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
  buildPhase?: "discovery" | "building";
}

const nodeTypes = {
  boardNode: BoardNode,
};

const PLACEHOLDER_NODES: Node<BoardNodeData>[] = [
  {
    id: "ph-agent",
    type: "boardNode",
    position: { x: 80, y: 220 },
    data: {
      label: "Agent",
      subtitle: "Persona & role",
      kind: "agent",
      placeholder: true,
    },
    draggable: false,
    selectable: false,
  },
  {
    id: "ph-instructions",
    type: "boardNode",
    position: { x: 420, y: 220 },
    data: {
      label: "Instructions",
      subtitle: "System prompt",
      kind: "instructions",
      placeholder: true,
    },
    draggable: false,
    selectable: false,
  },
  {
    id: "ph-tool",
    type: "boardNode",
    position: { x: 420, y: 420 },
    data: {
      label: "Tools",
      subtitle: "Web search, APIs…",
      kind: "tool",
      placeholder: true,
    },
    draggable: false,
    selectable: false,
  },
];

const PLACEHOLDER_EDGES: Edge[] = [
  {
    id: "ph-e1",
    source: "ph-agent",
    target: "ph-instructions",
    style: { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.12)" },
  },
  {
    id: "ph-e2",
    source: "ph-agent",
    sourceHandle: "bottom",
    target: "ph-tool",
    style: { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1.5, strokeDasharray: "6 4" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.12)" },
  },
];

function buildGraphFromSpec(
  spec: AgentSpec,
  seenNodeIds: Set<string>
): { nodes: Node<BoardNodeData>[]; edges: Edge[]; newCount: number } {
  const nodes: Node<BoardNodeData>[] = [];
  const edges: Edge[] = [];
  const hasSwarm = spec.agents && spec.agents.length > 0;
  let newCount = 0;

  const personaId = "persona";
  const personaIsNew = !seenNodeIds.has(personaId);
  if (personaIsNew) newCount++;

  nodes.push({
    id: personaId,
    type: "boardNode",
    position: { x: 80, y: 220 },
    data: {
      label: spec.name || "Untitled Agent",
      subtitle: spec.persona.role || "Define role",
      detail: spec.persona.tone ? `Tone: ${spec.persona.tone}` : undefined,
      kind: hasSwarm ? "orchestrator" : "agent",
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
      type: "boardNode",
      position: { x: 420, y: 220 },
      data: {
        label: "Instructions",
        subtitle: "System prompt",
        detail: spec.instructions,
        kind: "instructions",
        isNew,
        animDelay: isNew ? 100 : undefined,
      },
    });
    edges.push({
      id: "e-persona-instructions",
      source: personaId,
      target: instructionsId,
      animated: !isNew,
      className: isNew ? "edge-draw" : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
      style: { stroke: "#3b82f6", strokeWidth: 2, opacity: 0.65 },
    });
  }

  spec.tools.forEach((tool, index) => {
    const toolId = `tool-${tool.id}`;
    const isNew = !seenNodeIds.has(toolId);
    if (isNew) newCount++;
    nodes.push({
      id: toolId,
      type: "boardNode",
      position: { x: 80 + index * 280, y: 420 },
      data: {
        label: tool.name,
        subtitle: tool.type.replace("_", " "),
        kind: "tool",
        isNew,
        animDelay: isNew ? 100 + index * 80 : undefined,
      },
    });
    edges.push({
      id: `e-persona-${toolId}`,
      source: personaId,
      sourceHandle: "bottom",
      target: toolId,
      animated: !isNew,
      className: isNew ? "edge-draw" : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
      style: {
        stroke: "#10b981",
        strokeWidth: 2,
        opacity: 0.55,
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
        type: "boardNode",
        position: { x: 80 + index * 300, y: 620 },
        data: {
          label: agent.role,
          subtitle: "Sub-agent",
          detail: agent.instructions,
          kind: "swarm",
          isNew,
          animDelay: isNew ? 100 + index * 80 : undefined,
        },
      });

      const edgeTargets =
        agent.dependsOn.length === 0
          ? [{ id: `e-persona-${agentId}`, source: personaId, sourceHandle: "bottom" as const }]
          : agent.dependsOn.map((depId) => ({
              id: `e-${depId}-${agentId}`,
              source: `swarm-${depId}`,
              sourceHandle: undefined,
            }));

      edgeTargets.forEach(({ id, source, sourceHandle }) => {
        edges.push({
          id,
          source,
          sourceHandle,
          target: agentId,
          animated: !isNew,
          className: isNew ? "edge-draw" : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
          style: { stroke: "#f59e0b", strokeWidth: 2, opacity: 0.55 },
        });
      });
    });
  }

  return { nodes, edges, newCount };
}

function BoardCanvas({
  spec,
  isBuilding,
  buildProgress,
  buildPhase,
}: AgentGraphProps) {
  const seenNodeIdsRef = useRef<Set<string>>(new Set());
  const prevSpecKeyRef = useRef("");
  const [pulseKey, setPulseKey] = useState(0);
  const { fitView } = useReactFlow();

  const validSpec = useMemo(() => {
    const parsed = agentSpecSchema.safeParse(spec);
    return parsed.success ? parsed.data : defaultAgentSpec;
  }, [spec]);

  const isEmpty = isAgentSpecEmpty(validSpec);

  const { nodes, edges, newCount } = useMemo(() => {
    if (isEmpty) {
      return { nodes: PLACEHOLDER_NODES, edges: PLACEHOLDER_EDGES, newCount: 0 };
    }
    const graph = buildGraphFromSpec(validSpec, seenNodeIdsRef.current);
    graph.nodes.forEach((node) => seenNodeIdsRef.current.add(node.id));
    return graph;
  }, [validSpec, isEmpty]);

  useEffect(() => {
    if (isEmpty) {
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
  }, [validSpec, newCount, isEmpty]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);
    return () => clearTimeout(timer);
  }, [nodes.length, fitView, pulseKey]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const activeNodeCount = isEmpty ? 0 : nodes.length;

  return (
    <div className="relative h-full w-full">
      <BoardToolbar
        agentName={isEmpty ? undefined : validSpec.name}
        nodeCount={activeNodeCount}
        isBuilding={isBuilding && !isEmpty}
        onFitView={handleFitView}
      />

      {isEmpty && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-6">
          <div className="max-w-md rounded-xl border border-white/[0.06] bg-surface-1/90 px-4 py-3 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-foreground">
              {buildPhase === "discovery"
                ? "Your workflow will appear here"
                : "Canvas ready for assembly"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {buildPhase === "discovery"
                ? "Answer a few questions in chat, then start building to see nodes connect on this board."
                : "Describe your agent in chat — nodes will appear and connect as the spec is built."}
            </p>
            {buildProgress !== undefined && buildProgress > 0 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {buildProgress}% configured
              </p>
            )}
          </div>
        </div>
      )}

      {isBuilding && !isEmpty && (
        <div className="build-scan-line pointer-events-none absolute inset-x-0 top-14 z-10 h-16 bg-gradient-to-b from-transparent via-primary/[0.04] to-transparent" />
      )}

      <div key={pulseKey} className="board-canvas h-full w-full pt-12">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25, duration: 400 }}
          nodesDraggable={!isEmpty}
          nodesConnectable={false}
          elementsSelectable={!isEmpty}
          panOnDrag
          panOnScroll
          zoomOnScroll
          snapToGrid
          snapGrid={[20, 20]}
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.2}
            color="rgba(255,255,255,0.08)"
          />
          <Controls
            showInteractive={false}
            position="bottom-left"
            className="board-controls"
          />
        </ReactFlow>
      </div>

      {newCount > 0 && !isEmpty && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-surface-1/95 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-hud-sm backdrop-blur-sm">
          +{newCount} node{newCount > 1 ? "s" : ""} added
        </div>
      )}
    </div>
  );
}

export function AgentGraph(props: AgentGraphProps) {
  return (
    <HudPanel tier={2} className="relative h-full min-h-[420px] overflow-hidden">
      <ReactFlowProvider>
        <BoardCanvas {...props} />
      </ReactFlowProvider>
    </HudPanel>
  );
}
