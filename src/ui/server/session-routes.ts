import type { Route, RouteHandlers } from "./route-table.js";

/** The session tabs, what a session's buttons and menu do, and tasks that open a session of their own. */
export function sessionRoutes(h: RouteHandlers): [RegExp, Route][] {
  return [
    [/^\/api\/projects\/([^/]+)\/sessions$/, (_b, m) => h.tabs.createSession(decodeURIComponent(m[1]))],
    [/^\/api\/projects\/([^/]+)\/sessions\/close-all$/, (_b, m) => h.sweeps.closeAll(decodeURIComponent(m[1]))],
    [/^\/api\/projects\/([^/]+)\/sessions\/fresh-task$/, (b, m) => runInNewSession(h, decodeURIComponent(m[1]), b)],
    [
      /^\/api\/projects\/([^/]+)\/closed-sessions\/([\w-]+)\/reopen$/,
      (_b, m) => h.reopens.reopenSession(decodeURIComponent(m[1]), m[2]),
    ],
    [/^\/api\/sessions\/([\w-]+)\/activate$/, (_b, m) => h.tabs.activateSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/close$/, (_b, m) => h.sessions.closeSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/close-others$/, (_b, m) => h.sweeps.closeOthers(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/clear$/, (_b, m) => h.sessions.clearSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/stop$/, (_b, m) => h.sessions.stopTask(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/queue\/remove$/, (b, m) => h.queue.removeQueued(m[1], b)],
    [/^\/api\/sessions\/([\w-]+)\/handoff$/, (_b, m) => h.handoffs.handOff(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/model$/, (b, m) => h.models.setModel(m[1], b)],
  ];
}

async function runInNewSession(h: RouteHandlers, project: string, body: unknown): Promise<string> {
  return h.freshSessions.runInNewSession(project, await h.attached.task(body));
}
