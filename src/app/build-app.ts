import type { AppConfig } from "../config/app-config.js";
import { CommandExplainer } from "../permissions/command-explainer.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import type { ExplainCommand } from "../permissions/permission-types.js";
import type { PopupActions } from "../ui/popup-actions.js";
import { AssistantChatPopup } from "../ui/assistant-chat/assistant-chat-popup.js";
import type { ChatPanelDevice } from "../ui/assistant-chat/chat-panel.js";
import { ConfirmPopups, type ConfirmPanelDevice } from "../ui/confirm-popups.js";
import { LatestReply } from "../ui/latest-reply.js";
import { PermissionPopups, type PopupDevice } from "../ui/permission-popups.js";
import { QuestionPopups, type QuestionPanelDevice } from "../ui/question-popups.js";
import { LiveClients } from "../ui/server/live-clients.js";
import type { ProfileBrowser } from "../ui/server/link-actions.js";
import { PageOpener, type BrowserPage } from "../ui/server/page-opener.js";
import { LinkedNoticePanel } from "../ui/notices/linked-notice-panel.js";
import { TaskNotices, type NoticePanelDevice } from "../ui/notices/task-notices.js";
import { AfterTalking } from "../voice/after-talking.js";
import { ApprovalVoice, type VoiceApprovals } from "../voice/approval-voice.js";
import { VoiceWithDictation } from "../voice/voice-with-dictation.js";
import { WorkerVoice } from "../voice/worker-voice.js";
import { FrontSession } from "../ui/front-session.js";
import type { TaskActions } from "../ui/server/task-actions.js";
import { SessionTitles } from "../workers/session-titles.js";
import { TitleWriter } from "../workers/title-writer.js";
import { HeadlineWriter } from "../workers/headline-writer.js";
import { QuickModel } from "../workers/quick-model.js";
import { type TaskTopics, UNNAMED_TOPICS, WrittenTopics } from "../workers/task-topics.js";
import { ToolCallGate } from "../workers/tool-call-gate.js";
import { buildEditor, type EditorParts } from "./build-editor.js";
import { buildNotices, popupActionsFor, type NoticeParts } from "./build-notices.js";
import { buildOperator, type OperatorParts } from "./build-operator.js";
import { buildPermissions, type PermissionParts } from "./build-permissions.js";
import { buildQuestions, type QuestionParts } from "./build-questions.js";
import { buildTodo, type TodoParts } from "./build-todo.js";
import { buildUi, type UiParts } from "./build-ui.js";
import { buildWorkers, type WorkerModels, type WorkerParts } from "./build-workers.js";
import { buildCore, type Core } from "./core.js";
import type { OperatorDevices } from "./operator-types.js";

/** The app's ties to the outside world; tests pass fakes. */
export interface Adapters extends OperatorDevices {
  destructive: DestructiveList;
  /** Explain each permission request in plain words on its card and pop-up (one extra model call each). */
  explainCommands: boolean;
  /**
   * Name each new session's tab after its first task's main subject (one extra model call per session),
   * and announce each finished task by its topic and what got done (one extra model call per finished task).
   */
  nameSessions: boolean;
  /** Native pop-ups for permission requests. */
  popups: PopupDevice;
  /** Native pop-ups for a worker's questions. */
  questionPanels: QuestionPanelDevice;
  /** Native pop-ups for the assistant's confirm phrases. */
  confirmPanels: ConfirmPanelDevice;
  /** The native chat pop-up with your dialogue with the assistant, brought up by each finished reply. */
  chatPanels: ChatPanelDevice;
  /** The native notice panel, where ended tasks wait to be read and replied to. */
  notices: NoticePanelDevice;
  /** The web UI's page in your browser, brought to the front from a notice. */
  browser: BrowserPage;
  /** Chrome, opening links clicked in a project's chat in that project's Chrome profile. */
  chromeLinks: ProfileBrowser;
}

export interface App {
  core: Core;
  permissions: PermissionParts;
  questions: QuestionParts;
  workers: WorkerParts;
  todo: TodoParts;
  operator: OperatorParts;
  ui: UiParts;
  editor: EditorParts;
  notices: NoticeParts;
}

/** Builds everything; the operator listens to events before the timeline and the chats do. */
export function buildApp(cfg: AppConfig, adapters: Adapters): App {
  const routes = voiceRoutes(() => permissions.spoken);
  const devices = { ...adapters, voice: routedVoice(adapters, routes, () => ui.tasks) };
  const core = buildCore(cfg, adapters.destructive);
  const permissions = buildPermissions(core, commandExplanations(core, adapters));
  const questions = buildQuestions(core);
  const workers = buildWorkers(core, toolCallGate(permissions, questions), workerModels(core, adapters));
  if (adapters.nameSessions) sessionTitles(core, adapters).follow(workers.chat);
  const todo = buildTodo(core, workers.intake);
  const editor = buildEditor(cfg.editor);
  const neighbors = { permissions, questions, workers, todo, devices, editor, clients: new LiveClients() };
  const operator = buildOperator(core, neighbors);
  const pages = new PageOpener(neighbors.clients, adapters.browser, () => ui.server.link());
  const actions = popupActionsFor(pages, operator);
  const notices = buildNotices(workers.summarizer, actions);
  const ui = buildUi(core, { ...neighbors, notices, links: adapters.chromeLinks, front: routes.front }, operator);
  const app = { core, permissions, questions, workers, todo, operator, ui, editor, notices };
  showNatively(app, devices, actions);
  return app;
}

/** Where your words can go besides the assistant: the project tab in front, or a waiting permission request. */
interface VoiceRoutes {
  front: FrontSession;
  approvals: VoiceApprovals;
}

/**
 * Your voice, where recording with a page's mic button counts as talking too, a message that only says "allow" or
 * "deny" answers a waiting request, and a message started while a project tab is in front goes to its worker as a
 * task. The tasks come from the web UI, built after the operator.
 */
function routedVoice(adapters: Adapters, { front, approvals }: VoiceRoutes, tasks: () => TaskActions): WorkerVoice {
  const voice = new ApprovalVoice(new VoiceWithDictation(adapters.voice, adapters.dictation), front, approvals);
  return new WorkerVoice(voice, front, (session, text) => tasks().runTask(session, { instruction: text }));
}

/** Spoken approvals answer requests from the permissions, which are built after the voice. */
function voiceRoutes(spoken: () => VoiceApprovals): VoiceRoutes {
  const approvals: VoiceApprovals = {
    canAnswer: (words) => spoken().canAnswer(words),
    answer: (words, sessionInFront) => spoken().answer(words, sessionInFront),
  };
  return { front: new FrontSession(), approvals };
}

/** Plain-language explanations of commands, when the adapters want them. */
function commandExplanations(core: Core, adapters: Adapters): ExplainCommand | undefined {
  if (!adapters.explainCommands) return undefined;
  const explainer = new CommandExplainer(core.cfg, core.projects, adapters.query);
  return (project, command) => explainer.explain(project, command);
}

function sessionTitles(core: Core, adapters: Adapters): SessionTitles {
  return new SessionTitles(new TitleWriter(quickModel(core, adapters)), core.sessions);
}

/** Workers' tool calls wait for your approval or your answers to their questions. */
function toolCallGate(permissions: PermissionParts, questions: QuestionParts): ToolCallGate {
  return new ToolCallGate(permissions.broker, questions.broker);
}

function workerModels(core: Core, adapters: Adapters): WorkerModels {
  return { query: adapters.query, topics: taskTopics(core, adapters) };
}

/** Finished tasks get a written headline when sessions get written titles; else their own opening words. */
function taskTopics(core: Core, adapters: Adapters): TaskTopics {
  if (!adapters.nameSessions) return UNNAMED_TOPICS;
  return new WrittenTopics(new HeadlineWriter(quickModel(core, adapters)), core.sessions);
}

function quickModel(core: Core, adapters: Adapters): QuickModel {
  return new QuickModel(core.cfg, core.projects, adapters.query);
}

/**
 * Native pop-ups for requests, questions and the assistant's confirm phrases and chat, and the notice panel when a task ends,
 * so you see them from any app; none for quiet sessions.
 */
function showNatively({ core, ui, notices, operator }: App, adapters: Adapters, actions: PopupActions): void {
  const permissionPopups = new PermissionPopups(adapters.popups, ui.permissionClicks, actions);
  permissionPopups.follow(core.audibleEvents);
  const noticePanel = new LinkedNoticePanel(adapters.notices, () => ui.server.noticeLink());
  const afterTalking = new AfterTalking(adapters.voice);
  new TaskNotices(noticePanel, notices.inbox, notices.shownSessions).follow(core.audibleEvents, afterTalking);
  new QuestionPopups(adapters.questionPanels, ui.questionClicks, actions).follow(core.audibleEvents);
  const latestReply = new LatestReply();
  latestReply.follow(operator.lines);
  const confirmPopups = new ConfirmPopups(adapters.confirmPanels, operator.clickedWords, permissionPopups);
  confirmPopups.follow(operator.confirmAsk, latestReply);
  const chatPopup = new AssistantChatPopup(adapters.chatPanels, operator.clickedWords, operator.confirmAsk);
  chatPopup.follow(operator.lines, operator.context);
}

/** The operator's model session starts, then it listens for your voice. */
export async function startOperator(app: App, voice: OperatorDevices["voice"]): Promise<void> {
  app.operator.session.start();
  await voice.start();
}
