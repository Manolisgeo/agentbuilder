export type SwarmMemoryState = Record<string, unknown>;

export type MemoryWriteEvent = {
  state: SwarmMemoryState;
  writes: { key: string; agentRole: string }[];
};

export function resolveMemoryTemplates(
  text: string,
  state: SwarmMemoryState
): string {
  return text.replace(/\{\{memory\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const val = state[key];
    if (val === undefined || val === null) return "";
    if (typeof val === "string") return val;
    return JSON.stringify(val);
  });
}

export function applyMemoryWrite(
  state: SwarmMemoryState,
  writes: Record<string, unknown>
): SwarmMemoryState {
  return { ...state, ...writes };
}
