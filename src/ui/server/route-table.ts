import type { PermissionPolicy } from "../../permissions/permission-policy.js";
import type { AssistantActions } from "./assistant-actions.js";
import type { PermissionActions } from "./permission-actions.js";
import { permissionModeBody } from "./request-body.js";
import type { SessionActions } from "./session-actions.js";
import type { TabActions } from "./tab-actions.js";
import type { TaskActions } from "./task-actions.js";

type Route = (body: unknown, match: RegExpMatchArray) => string | Promise<string>;

/** What each group of POST routes acts on. */
export interface RouteHandlers {
  assistant: AssistantActions;
  policy: PermissionPolicy;
  permissions: PermissionActions;
  tabs: TabActions;
  tasks: TaskActions;
  sessions: SessionActions;
}

/** The page's actions by path; each answers with a message the page may show. */
export class RouteTable {
  private routes: [RegExp, Route][];

  constructor(h: RouteHandlers) {
    this.routes = [
      [/^\/api\/message$/, (b) => h.assistant.sendMessage(b)],
      [/^\/api\/assistant\/clear$/, () => h.assistant.clearAssistant()],
      [/^\/api\/permissions\/(\w+)$/, (b, m) => h.permissions.answer(m[1], b)],
      [/^\/api\/permission-mode$/, (b) => h.policy.setMode(permissionModeBody.parse(b).mode)],
      [/^\/api\/speech-mode$/, (b) => h.assistant.setSpeechMode(b)],
      [/^\/api\/projects\/([^/]+)\/sessions$/, (_b, m) => h.tabs.createSession(decodeURIComponent(m[1]))],
      [/^\/api\/sessions\/([\w-]+)\/activate$/, (_b, m) => h.tabs.activateSession(m[1])],
      [/^\/api\/sessions\/([\w-]+)\/close$/, (_b, m) => h.sessions.closeSession(m[1])],
      [/^\/api\/sessions\/([\w-]+)\/clear$/, (_b, m) => h.sessions.clearSession(m[1])],
      [/^\/api\/sessions\/([\w-]+)\/tasks$/, (b, m) => h.tasks.runTask(m[1], b)],
      [/^\/api\/sessions\/([\w-]+)\/stop$/, (_b, m) => h.sessions.stopTask(m[1])],
    ];
  }

  find(pathname: string): { route: Route; match: RegExpMatchArray } | undefined {
    for (const [pattern, route] of this.routes) {
      const match = pathname.match(pattern);
      if (match) return { route, match };
    }
    return undefined;
  }
}
