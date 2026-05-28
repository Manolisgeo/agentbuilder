"use client";

import type { AgentSpec } from "./agent-spec";
import { agentSpecSchema } from "./agent-spec";

const STORAGE_KEY = "agent-library";

export interface StoredAgent {
  id: string;
  savedAt: string;
  updatedAt: string;
  spec: AgentSpec;
}

function read(): StoredAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredAgent[];
  } catch {
    return [];
  }
}

function write(agents: StoredAgent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export function listAgents(): StoredAgent[] {
  return read().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getAgent(id: string): StoredAgent | null {
  return read().find((a) => a.id === id) ?? null;
}

/** Upsert — creates a new entry if id is omitted, updates existing if id matches. */
export function saveAgent(spec: AgentSpec, id?: string): StoredAgent {
  const validated = agentSpecSchema.parse(spec);
  const now = new Date().toISOString();
  const agents = read();

  if (id) {
    const idx = agents.findIndex((a) => a.id === id);
    if (idx !== -1) {
      agents[idx] = { ...agents[idx], updatedAt: now, spec: validated };
      write(agents);
      return agents[idx];
    }
  }

  const entry: StoredAgent = {
    id: id ?? crypto.randomUUID(),
    savedAt: now,
    updatedAt: now,
    spec: validated,
  };
  agents.push(entry);
  write(agents);
  return entry;
}

export function deleteAgent(id: string): void {
  write(read().filter((a) => a.id !== id));
}
