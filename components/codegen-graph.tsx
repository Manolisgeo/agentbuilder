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
  codeSpecSchema,
  defaultCodeSpec,
  isCodeSpecEmpty,
  type CodeFlowNode,
  type CodeSpec,
} from "@/lib/codegen-types";

interface CodegenGraphProps {
  spec: CodeSpec;
  isBuilding?: boolean;
}

const nodeTypes = { boardNode: BoardNode };

const ROW_Y: Record<CodeFlowNode["kind"], number> = {
  trigger: 80,
  input: 280,
  processor: 480,
  output: 680,
  dependency: 880,
};

const EDGE_COLORS: Record<string, string> = {
  "trigger-input": "#06b6d4",
  "input-processor": "#3b82f6",
  "processor-output": "#10b981",
};

function edgeColor(sourceKind: string, targetKind: string): string {
  return EDGE_COLORS[`${sourceKind}-${targetKind}`] ?? "rgba(255,255,255,0.25)";
}

const PLACEHOLDER_NODES: Node<BoardNodeData>[] = [
  {
    id: "ph-trigger",
    type: "boardNode",
    position: { x: 80, y: 80 },
    data: { label: "Trigger", subtitle: "Entry point", kind: "trigger", placeholder: true },
    draggable: false,
    selectable: false,
  },
  {
    id: "ph-input",
    type: "boardNode",
    position: { x: 80, y: 280 },
    data: { label: "Input", subtitle: "Data source", kind: "input", placeholder: true },
    draggable: false,
    selectable: false,
  },
  {
    id: "ph-output",
    type: "boardNode",
    position: { x: 80, y: 480 },
    data: { label: "Output", subtitle: "Delivery target", kind: "output", placeholder: true },
    draggable: false,
    selectable: false,
  },
];

const PLACEHOLDER_EDGES: Edge[] = [
  {
    id: "ph-e1",
    source: "ph-trigger",
    target: "ph-input",
    style: { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.12)" },
  },
  {
    id: "ph-e2",
    source: "ph-input",
    target: "ph-output",
    style: { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1.5, strokeDasharray: "6 4" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.12)" },
  },
];

function buildGraphFromCodeSpec(
  spec: CodeSpec,
  seenNodeIds: Set<string>
): { nodes: Node<BoardNodeData>[]; edges: Edge[]; newCount: number } {
  const nodes: Node<BoardNodeData>[] = [];
  const edges: Edge[] = [];
  let newCount = 0;

  const byKind: Record<CodeFlowNode["kind"], CodeFlowNode[]> = {
    trigger: [],
    input: [],
    processor: [],
    output: [],
    dependency: [],
  };
  for (const node of spec.nodes) {
    byKind[node.kind].push(node);
  }

  const nodeKindMap: Record<string, CodeFlowNode["kind"]> = {};
  for (const node of spec.nodes) {
    nodeKindMap[node.id] = node.kind;
  }

  for (const node of spec.nodes) {
    const sameKind = byKind[node.kind];
    const idx = sameKind.indexOf(node);
    const x = 80 + idx * 300;
    const y = ROW_Y[node.kind];
    const isNew = !seenNodeIds.has(node.id);
    if (isNew) newCount++;

    nodes.push({
      id: node.id,
      type: "boardNode",
      position: { x, y },
      data: {
        label: node.label,
        subtitle: node.subtitle,
        detail: node.detail,
        kind: node.kind,
        isNew,
        animDelay: isNew ? idx * 80 : undefined,
      },
    });
  }

  // Canonical upstream row for automatic edges (when dependsOn is empty)
  const canonicalUpstream: Partial<Record<CodeFlowNode["kind"], CodeFlowNode["kind"]>> = {
    input: "trigger",
    processor: "input",
    output: "processor",
    dependency: "output",
  };

  for (const node of spec.nodes) {
    const sources: Array<{ id: string; kind: CodeFlowNode["kind"] }> =
      node.dependsOn.length > 0
        ? node.dependsOn
            .filter((depId) => nodeKindMap[depId])
            .map((depId) => ({ id: depId, kind: nodeKindMap[depId] }))
        : byKind[canonicalUpstream[node.kind] ?? "trigger"].map((n) => ({
            id: n.id,
            kind: n.kind,
          }));

    for (const src of sources) {
      const color = edgeColor(src.kind, node.kind);
      const isNew = !seenNodeIds.has(node.id) || !seenNodeIds.has(src.id);
      edges.push({
        id: `e-${src.id}-${node.id}`,
        source: src.id,
        target: node.id,
        animated: !isNew,
        className: isNew ? "edge-draw" : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2, opacity: 0.65 },
      });
    }
  }

  return { nodes, edges, newCount };
}

function BoardCanvas({ spec, isBuilding }: CodegenGraphProps) {
  const seenNodeIdsRef = useRef<Set<string>>(new Set());
  const prevSpecKeyRef = useRef("");
  const [pulseKey, setPulseKey] = useState(0);
  const { fitView } = useReactFlow();

  const validSpec = useMemo(() => {
    const parsed = codeSpecSchema.safeParse(spec);
    return parsed.success ? parsed.data : defaultCodeSpec;
  }, [spec]);

  const isEmpty = isCodeSpecEmpty(validSpec);

  const { nodes, edges, newCount } = useMemo(() => {
    if (isEmpty) {
      return { nodes: PLACEHOLDER_NODES, edges: PLACEHOLDER_EDGES, newCount: 0 };
    }
    const graph = buildGraphFromCodeSpec(validSpec, seenNodeIdsRef.current);
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
      if (newCount > 0) setPulseKey((k) => k + 1);
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
              Architecture will appear here
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Describe your agent script in chat — nodes will connect as the
              architecture is assembled.
            </p>
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
          minZoom={0.3}
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

export function CodegenGraph(props: CodegenGraphProps) {
  return (
    <HudPanel tier={2} className="relative h-full min-h-[420px] overflow-hidden">
      <ReactFlowProvider>
        <BoardCanvas {...props} />
      </ReactFlowProvider>
    </HudPanel>
  );
}
