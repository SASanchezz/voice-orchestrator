import type { SessionState } from "./registry-schema.js";

export function emptySession(id: string, project: string, number: number): SessionState {
  return { id, project, number, status: "idle", queued: [], costUsd: 0, history: [] };
}

/** A saved session after a restart: anything that was mid-run when we died is not running anymore. */
export function afterRestart(session: SessionState): SessionState {
  const wasRunning = ["running", "waiting_permission"].includes(session.status);
  return { ...session, status: wasRunning ? "stopped" : session.status, queued: [], lastActivity: undefined };
}
