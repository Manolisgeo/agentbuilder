import { z } from "zod";

export const codeFlowNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["trigger", "input", "processor", "output", "dependency"]),
  label: z.string(),
  subtitle: z.string().optional(),
  detail: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
});

export const codeFlowNodePatchSchema = codeFlowNodeSchema.partial().required({ id: true });

export const codeSpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(codeFlowNodeSchema),
});

export const codeSpecPatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(codeFlowNodeSchema).optional(),
});

export type CodeFlowNode = z.infer<typeof codeFlowNodeSchema>;
export type CodeSpec = z.infer<typeof codeSpecSchema>;
export type CodeSpecPatch = z.infer<typeof codeSpecPatchSchema>;

export const defaultCodeSpec: CodeSpec = { name: "Untitled Script", nodes: [] };

export function mergeCodeSpec(current: CodeSpec, patch: CodeSpecPatch): CodeSpec {
  const patchNodes = patch.nodes ?? [];
  const merged = [...current.nodes];
  for (const patchNode of patchNodes) {
    const idx = merged.findIndex((n) => n.id === patchNode.id);
    if (idx >= 0) merged[idx] = { ...merged[idx], ...patchNode };
    else merged.push(patchNode);
  }
  return codeSpecSchema.parse({
    name: patch.name ?? current.name,
    description: patch.description ?? current.description,
    nodes: merged,
  });
}

export function isCodeSpecEmpty(spec: CodeSpec): boolean {
  return spec.nodes.length === 0;
}
