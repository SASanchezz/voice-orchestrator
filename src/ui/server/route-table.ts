import type { PermissionPolicy } from "../../permissions/permission-policy.js";
import type { AppActions } from "./app-actions.js";
import type { AssistantActions } from "./assistant-actions.js";
import type { AttachedText } from "./attached-text.js";
import { MAX_ATTACHED_BODY_BYTES } from "./attachment-body.js";
import type { PermissionActions } from "./permission-actions.js";
import type { QuestionActions } from "./question-actions.js";
import { MAX_BODY_BYTES, permissionModeBody } from "./request-body.js";
import type { SessionActions } from "./session-actions.js";
import type { TabActions } from "./tab-actions.js";
import type { TaskActions } from "./task-actions.js";
import type { VoiceOfferActions } from "./voice-offer-actions.js";

type Route = (body: unknown, match: RegExpMatchArray) => string | Promise<string>;

/** A route found for a path, with the largest body it takes. */
export interface FoundRoute {
  route: Route;
  match: RegExpMatchArray;
  maxBodyBytes: number;
}

/** What each group of POST routes acts on. */
export interface RouteHandlers {
  app: AppActions;
  assistant: AssistantActions;
  /** Saves the files attached to a message or task and lists them after its text. */
  attached: AttachedText;
  policy: PermissionPolicy;
  permissions: PermissionActions;
  questions: QuestionActions;
  tabs: TabActions;
  tasks: TaskActions;
  sessions: SessionActions;
  voiceOffers: VoiceOfferActions;
}

/** The page's actions by path; each answers with a message the page may show. */
export class RouteTable {
  private routes: [RegExp, Route][];
  /** Only these take files, so only they accept large bodies. */
  private attachedRoutes: Route[];

  constructor(h: RouteHandlers) {
    const sendMessage: Route = (b) => h.assistant.sendMessage(h.attached.message(b));
    const runTask: Route = (b, m) => h.tasks.runTask(m[1], h.attached.instruction(b));
    const attachToVoice: Route = (b, m) => h.voiceOffers.sendWithFiles(m[1], h.attached.savedFiles(b));
    this.attachedRoutes = [sendMessage, runTask, attachToVoice];
    this.routes = [
      [/^\/api\/message$/, sendMessage],
      [/^\/api\/sessions\/([\w-]+)\/tasks$/, runTask],
      [/^\/api\/voice-offers\/(\w+)\/attach$/, attachToVoice],
      ...fileFreeRoutes(h),
    ];
  }

  find(pathname: string): FoundRoute | undefined {
    for (const [pattern, route] of this.routes) {
      const match = pathname.match(pattern);
      if (match) return { route, match, maxBodyBytes: this.maxBodyBytes(route) };
    }
    return undefined;
  }

  private maxBodyBytes(route: Route): number {
    return this.attachedRoutes.includes(route) ? MAX_ATTACHED_BODY_BYTES : MAX_BODY_BYTES;
  }
}

/** The routes that take no files. */
function fileFreeRoutes(h: RouteHandlers): [RegExp, Route][] {
  return [
    [/^\/api\/restart$/, () => h.app.restartApp()],
    [/^\/api\/draft$/, (b) => h.voiceOffers.draftChanged(b)],
    [/^\/api\/voice-offers\/(\w+)\/keep$/, (_b, m) => h.voiceOffers.keepInDraft(m[1])],
    [/^\/api\/assistant\/clear$/, () => h.assistant.clearAssistant()],
    [/^\/api\/permissions\/(\w+)$/, (b, m) => h.permissions.answer(m[1], b)],
    [/^\/api\/questions\/(\w+)\/answer$/, (b, m) => h.questions.answer(m[1], b)],
    [/^\/api\/questions\/(\w+)\/skip$/, (_b, m) => h.questions.skip(m[1])],
    [/^\/api\/permission-mode$/, (b) => h.policy.setMode(permissionModeBody.parse(b).mode)],
    [/^\/api\/speech-mode$/, (b) => h.assistant.setSpeechMode(b)],
    [/^\/api\/projects\/([^/]+)\/sessions$/, (_b, m) => h.tabs.createSession(decodeURIComponent(m[1]))],
    [/^\/api\/sessions\/([\w-]+)\/activate$/, (_b, m) => h.tabs.activateSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/close$/, (_b, m) => h.sessions.closeSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/clear$/, (_b, m) => h.sessions.clearSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/stop$/, (_b, m) => h.sessions.stopTask(m[1])],
  ];
}
