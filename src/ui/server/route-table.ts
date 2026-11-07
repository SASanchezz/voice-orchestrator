import type { VoiceCancel } from "../../orchestrator/conversation/voice-cancel.js";
import type { PermissionPolicy } from "../../permissions/permission-policy.js";
import type { GestureControl } from "../../sensors/gesture-switch.js";
import type { DictationControl } from "../../voice/dictation.js";
import type { AppActions } from "./app-actions.js";
import type { AssistantActions } from "./assistant-actions.js";
import type { AttachedText } from "./attached-text.js";
import type { ChangeActions } from "./change-actions.js";
import type { HandoffActions } from "./handoff-actions.js";
import { MAX_ATTACHED_BODY_BYTES } from "./attachment-body.js";
import type { PermissionActions } from "./permission-actions.js";
import type { QuestionActions } from "./question-actions.js";
import type { QueueActions } from "./queue-actions.js";
import type { NoticeActions } from "../notices/notice-actions.js";
import type { ShownSessions } from "../notices/shown-sessions.js";
import {
  gestureModeBody,
  MAX_BODY_BYTES,
  noticeOpenBody,
  permissionModeBody,
  shownSessionBody,
} from "./request-body.js";
import type { SessionActions } from "./session-actions.js";
import type { SessionSweepActions } from "./session-sweep-actions.js";
import type { TabActions } from "./tab-actions.js";
import type { TaskActions } from "./task-actions.js";
import { todoItemRoutes, type TodoItemHandlers } from "./todo-item-routes.js";
import type { VoiceOfferActions } from "./voice-offer-actions.js";

export type Route = (body: unknown, match: RegExpMatchArray) => string | Promise<string>;

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
  changes: ChangeActions;
  /** The mic button: your words, recorded and transcribed on this Mac. */
  dictation: DictationControl;
  gestures: GestureControl;
  handoffs: HandoffActions;
  /** The notice panel's buttons; its replies go through `tasks`. */
  notices: NoticeActions;
  policy: PermissionPolicy;
  permissions: PermissionActions;
  questions: QuestionActions;
  queue: QueueActions;
  tabs: TabActions;
  tasks: TaskActions;
  todoItems: TodoItemHandlers;
  sessions: SessionActions;
  /** Which session each open page has on screen, so a task ending there brings up no notice. */
  shownSessions: ShownSessions;
  sweeps: SessionSweepActions;
  voice: VoiceCancel;
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
      [/^\/api\/projects\/([^/]+)\/changes\/stage$/, (b, m) => h.changes.stage(decodeURIComponent(m[1]), b)],
      ...todoItemRoutes(h.todoItems),
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
    [/^\/api\/assistant\/clear$/, () => h.assistant.clearAssistant()],
    [/^\/api\/permissions\/(\w+)$/, (b, m) => h.permissions.answer(m[1], b)],
    [/^\/api\/questions\/(\w+)\/answer$/, (b, m) => h.questions.answer(m[1], b)],
    [/^\/api\/questions\/(\w+)\/skip$/, (_b, m) => h.questions.skip(m[1])],
    [/^\/api\/permission-mode$/, (b) => h.policy.setMode(permissionModeBody.parse(b).mode)],
    [/^\/api\/speech-mode$/, (b) => h.assistant.setSpeechMode(b)],
    [/^\/api\/gestures$/, (b) => h.gestures.setMode(gestureModeBody.parse(b).mode)],
    ...sessionRoutes(h),
    ...noticeRoutes(h),
    ...voiceRoutes(h),
  ];
}

/** The session tabs and what a session's buttons and menu do. */
function sessionRoutes(h: RouteHandlers): [RegExp, Route][] {
  return [
    [/^\/api\/projects\/([^/]+)\/sessions$/, (_b, m) => h.tabs.createSession(decodeURIComponent(m[1]))],
    [/^\/api\/projects\/([^/]+)\/sessions\/close-all$/, (_b, m) => h.sweeps.closeAll(decodeURIComponent(m[1]))],
    [/^\/api\/sessions\/([\w-]+)\/activate$/, (_b, m) => h.tabs.activateSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/close$/, (_b, m) => h.sessions.closeSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/close-others$/, (_b, m) => h.sweeps.closeOthers(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/clear$/, (_b, m) => h.sessions.clearSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/stop$/, (_b, m) => h.sessions.stopTask(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/queue\/remove$/, (b, m) => h.queue.removeQueued(m[1], b)],
    [/^\/api\/sessions\/([\w-]+)\/handoff$/, (_b, m) => h.handoffs.handOff(m[1])],
  ];
}

/**
 * The notice panel: seen, closed by you or by itself, a web UI view opened, or a longer explanation asked for; and the
 * session a web UI page has on screen, which needs no notice.
 */
function noticeRoutes(h: RouteHandlers): [RegExp, Route][] {
  return [
    [/^\/api\/notices\/(\w+)\/seen$/, (_b, m) => h.notices.markSeen(m[1])],
    [/^\/api\/notices\/(\w+)\/close$/, (_b, m) => h.notices.close(m[1])],
    [/^\/api\/notices\/(\w+)\/expire$/, (_b, m) => h.notices.expire(m[1])],
    [/^\/api\/notices\/(\w+)\/open$/, (b, m) => h.notices.open(m[1], noticeOpenBody.parse(b).view)],
    [/^\/api\/notices\/(\w+)\/explain$/, (_b, m) => h.notices.explain(m[1])],
    [/^\/api\/shown-session$/, (b) => noteShownSession(h.shownSessions, b)],
  ];
}

function noteShownSession(shownSessions: ShownSessions, body: unknown): string {
  const { page, session } = shownSessionBody.parse(body);
  if (session) shownSessions.pageShows(page, session);
  else shownSessions.pageShowsNoSession(page);
  return "Noted.";
}

/**
 * Discarding your voice message, and whether one waiting goes with the draft's files. The mic button's words go back
 * to the page, into its message box.
 */
function voiceRoutes(h: RouteHandlers): [RegExp, Route][] {
  return [
    [/^\/api\/dictation\/start$/, () => h.dictation.start()],
    [/^\/api\/dictation\/cancel$/, () => h.dictation.cancel()],
    [/^\/api\/dictation\/finish$/, () => h.dictation.finish()],
    [/^\/api\/voice\/discard$/, () => h.voice.discardLatest()],
    [/^\/api\/draft$/, (b) => h.voiceOffers.draftChanged(b)],
    [/^\/api\/voice-offers\/(\w+)\/keep$/, (_b, m) => h.voiceOffers.keepInDraft(m[1])],
    [/^\/api\/voice-offers\/(\w+)\/discard$/, (_b, m) => h.voiceOffers.discard(m[1])],
  ];
}
