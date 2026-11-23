import type { RestartableEditor } from "../../editor/editor.js";
import type { VoiceCancel } from "../../orchestrator/conversation/voice-cancel.js";
import type { PermissionPolicy } from "../../permissions/permission-policy.js";
import type { GestureControl } from "../../sensors/gesture-switch.js";
import type { WakeWordControl } from "../../wake/wake-switch.js";
import type { WakeTrainingControl } from "../../wake/wake-training.js";
import { wakeTrainingRoutes } from "./wake-training-routes.js";
import { editorRoutes } from "./editor-routes.js";
import { voiceRoutes } from "./voice-routes.js";
import type { AppActions } from "./app-actions.js";
import type { AssistantActions } from "./assistant-actions.js";
import type { AttachedText } from "./attached-text.js";
import type { ChangeActions } from "./change-actions.js";
import type { MicActions } from "./mic-actions.js";
import type { SpokenMessages } from "../../orchestrator/conversation/spoken-messages.js";
import type { FrontSessionActions } from "./front-session-actions.js";
import type { FreshSessionTasks } from "./fresh-session-tasks.js";
import type { HandoffActions } from "./handoff-actions.js";
import type { LinkActions } from "./link-actions.js";
import { MAX_ATTACHED_BODY_BYTES } from "./attachment-body.js";
import type { DraftingActions } from "./drafting-actions.js";
import type { PermissionActions } from "./permission-actions.js";
import type { QuestionActions } from "./question-actions.js";
import type { QueueActions } from "./queue-actions.js";
import type { ReplyActions } from "./reply-routes.js";
import { messageViewRoutes } from "./message-view-routes.js";
import type { NoticeActions } from "../notices/notice-actions.js";
import type { ShownSessions } from "../notices/shown-sessions.js";
import {
  gestureModeBody,
  MAX_BODY_BYTES,
  noticeOpenBody,
  permissionModeBody,
  shownSessionBody,
  wakeWordModeBody,
} from "./request-body.js";
import type { SessionActions } from "./session-actions.js";
import type { SessionModelActions } from "./session-model-actions.js";
import type { SessionSweepActions } from "./session-sweep-actions.js";
import type { ReopenActions } from "./reopen-actions.js";
import { sessionRoutes } from "./session-routes.js";
import type { TabActions } from "./tab-actions.js";
import type { TaskActions } from "./task-actions.js";
import type { ChatSendActions } from "./chat-send-actions.js";
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
  /** The Code view's VS Code, restarted by hand when it misbehaves. */
  editor: RestartableEditor;
  /** The mic buttons, and the page your words go into while you talk. */
  mic: MicActions;
  /** Your spoken words, sent to the assistant from a page's message box. */
  spoken: SpokenMessages;
  gestures: GestureControl;
  wakeWord: WakeWordControl;
  /** The Train wake word dialog: your recordings, the model trained on them, and trying it out. */
  wakeTraining: WakeTrainingControl;
  frontSession: FrontSessionActions;
  handoffs: HandoffActions;
  /** Links clicked in a project's chat, opened in its Chrome profile. */
  links: LinkActions;
  /** The notice panel's buttons; its replies go through `tasks`. */
  notices: NoticeActions;
  policy: PermissionPolicy;
  permissions: PermissionActions;
  questions: QuestionActions;
  queue: QueueActions;
  replies: ReplyActions;
  /** What you write in the Messages view's All chats. */
  chats: ChatSendActions;
  /** Whether new messages get drafted replies. */
  drafting: DraftingActions;
  tabs: TabActions;
  reopens: ReopenActions;
  tasks: TaskActions;
  /** Tasks that open a session of their own, like questions asked from the Review view. */
  freshSessions: FreshSessionTasks;
  todoItems: TodoItemHandlers;
  sessions: SessionActions;
  /** The model a session's worker runs on. */
  models: SessionModelActions;
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
    const sendMessage: Route = async (b) => h.assistant.sendMessage(await h.attached.message(b));
    const sendSpoken: Route = async (b) => h.spoken.receive(await h.attached.message(b));
    const runTask: Route = async (b, m) => h.tasks.runTask(m[1], await h.attached.task(b));
    const attachToVoice: Route = async (b, m) => h.voiceOffers.sendWithFiles(m[1], await h.attached.savedFiles(b));
    this.attachedRoutes = [sendMessage, sendSpoken, runTask, attachToVoice];
    this.routes = [
      [/^\/api\/message$/, sendMessage],
      [/^\/api\/message\/spoken$/, sendSpoken],
      [/^\/api\/sessions\/([\w-]+)\/tasks$/, runTask],
      [/^\/api\/voice-offers\/(\w+)\/attach$/, attachToVoice],
      ...fileFreeRoutes(h),
      [/^\/api\/projects\/([^/]+)\/changes\/stage$/, (b, m) => h.changes.stage(decodeURIComponent(m[1]), b)],
      ...todoItemRoutes(h.todoItems),
      ...messageViewRoutes(h),
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
    [/^\/api\/clicked-words$/, (b) => h.assistant.sendClickedWords(b)],
    [/^\/api\/links\/open$/, (b) => h.links.open(b)],
    [/^\/api\/permissions\/(\w+)$/, (b, m) => h.permissions.answer(m[1], b)],
    [/^\/api\/questions\/(\w+)\/answer$/, (b, m) => h.questions.answer(m[1], b)],
    [/^\/api\/questions\/(\w+)\/skip$/, (_b, m) => h.questions.skip(m[1])],
    [/^\/api\/permission-mode$/, (b) => h.policy.setMode(permissionModeBody.parse(b).mode)],
    [/^\/api\/speech-mode$/, (b) => h.assistant.setSpeechMode(b)],
    [/^\/api\/gestures$/, (b) => h.gestures.setMode(gestureModeBody.parse(b).mode)],
    [/^\/api\/wake-word$/, (b) => h.wakeWord.setMode(wakeWordModeBody.parse(b).mode)],
    ...sessionRoutes(h),
    ...noticeRoutes(h),
    ...voiceRoutes(h),
    ...wakeTrainingRoutes(h.wakeTraining),
    ...editorRoutes(h.editor),
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
