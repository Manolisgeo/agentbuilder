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
import { BookOpen, Bot, Search, Users } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  agentSpecSchema,
  defaultAgentSpec,
  isAgentSpecEmpty,
  type AgentSpec,
} from "@/lib/agent-spec";

interface AgentGraphProps {
  spec: AgentSpec;
}

type CustomNodeData = {
  label: string;
  subtitle?: string;
  detail?: string;
  icon: "persona" | "instructions" | "tool" | "orchestrator" | "swarm";
  isNew?: boolean;
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
      className={`min-w-[180px] max-w-[240px] rounded-xl border bg-card px-4 py-3 shadow-lg transition-all duration-500 ${
        data.isNew
          ? "animate-in fade-in zoom-in-95 slide-in-from-bottom-4 border-primary/50 shadow-primary/20"
          : "border-border"
      }`}
    >
      {data.icon !== "orchestrator" && (
        <Handle type="target" position={Position.Top} className="!bg-primary" />
      )}
      <div className="flex items-start gap-2">
        <div className="rounded-md bg-primary/10 p-1.5">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{data.label}</p>
          {data.subtitle && (
            <p className="truncate text-xs text-muted-foreground">
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
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}

const nodeTypes = {
  agentNode: GraphNode,
};

function buildGraphFromSpec(
  spec: AgentSpec,
  seenNodeIds: Set<string>
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } {
  const nodes: Node<CustomNodeData>[] = [];
  const edges: Edge[] = [];
  const hasSwarm = spec.agents && spec.agents.length > 0;

  const personaId = "persona";
  nodes.push({
    id: personaId,
    type: "agentNode",
    position: { x: 280, y: 20 },
    data: {
      label: spec.name || "Untitled Agent",
      subtitle: spec.persona.role || "Define a role…",
      detail: spec.persona.tone ? `Tone: ${spec.persona.tone}` : undefined,
      icon: hasSwarm ? "orchestrator" : "persona",
      isNew: !seenNodeIds.has(personaId),
    },
  });

  const instructionsId = "instructions";
  if (spec.instructions) {
    nodes.push({
      id: instructionsId,
      type: "agentNode",
      position: { x: 280, y: 180 },
      data: {
        label: "Instructions",
        detail: spec.instructions,
        icon: "instructions",
        isNew: !seenNodeIds.has(instructionsId),
      },
    });
    edges.push({
      id: "e-persona-instructions",
      source: personaId,
      target: instructionsId,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "var(--primary)" },
    });
  }

  spec.tools.forEach((tool, index) => {
    const toolId = `tool-${tool.id}`;
    const x = 80 + index * 200;
    nodes.push({
      id: toolId,
      type: "agentNode",
      position: { x, y: 360 },
      data: {
        label: tool.name,
        subtitle: tool.type.replace("_", " "),
        icon: "tool",
        isNew: !seenNodeIds.has(toolId),
      },
    });
    edges.push({
      id: `e-persona-${toolId}`,
      source: personaId,
      target: toolId,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "var(--primary)" },
    });
  });

  if (hasSwarm && spec.agents) {
    spec.agents.forEach((agent, index) => {
      const agentId = `swarm-${agent.id}`;
      const x = 80 + index * 220;
      nodes.push({
        id: agentId,
        type: "agentNode",
        position: { x, y: 540 },
        data: {
          label: agent.role,
          detail: agent.instructions,
          icon: "swarm",
          isNew: !seenNodeIds.has(agentId),
        },
      });

      if (agent.dependsOn.length === 0) {
        edges.push({
          id: `e-persona-${agentId}`,
          source: personaId,
          target: agentId,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      } else {
        agent.dependsOn.forEach((depId) => {
          edges.push({
            id: `e-${depId}-${agentId}`,
            source: `swarm-${depId}`,
            target: agentId,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          });
        });
      }
    });
  }

  return { nodes, edges };
}

export function AgentGraph({ spec }: AgentGraphProps) {
  const seenNodeIdsRef = useRef<Set<string>>(new Set());
  const parsed = agentSpecSchema.safeParse(spec);
  const validSpec = parsed.success ? parsed.data : defaultAgentSpec;

  const { nodes, edges } = useMemo(() => {
    const graph = buildGraphFromSpec(validSpec, seenNodeIdsRef.current);
    graph.nodes.forEach((node) => seenNodeIdsRef.current.add(node.id));
    return graph;
  }, [validSpec]);

  useEffect(() => {
    if (isAgentSpecEmpty(validSpec)) {
      seenNodeIdsRef.current.clear();
    }
  }, [validSpec]);

  const isEmpty =
    !validSpec.persona.role &&
    !validSpec.instructions &&
    validSpec.tools.length === 0 &&
    !validSpec.agents?.length;

  return (
    <div className="relative h-full w-full bg-[radial-gradient(circle_at_top,_var(--muted)_0%,_transparent_55%)]">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <Badge variant="secondary">Live preview</Badge>
        <span className="text-xs text-muted-foreground">
          {validSpec.name}
        </span>
      </div>

      {isEmpty ? (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="size-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Your agent will appear here</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Start chatting to watch nodes assemble in real time — persona,
              tools, and instructions.
            </p>
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}
    </div>
  );
}
