import type { AppConfig } from "../config/app-config.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import type { PopupActions } from "../ui/popup-actions.js";
import { AssistantChatPopup } from "../ui/assistant-chat/assistant-chat-popup.js";
import { VoicedChatPanels, type VoicedChatPanelDevice } from "../ui/voice-box/voiced-chat-panels.js";
import { VoicedQuestionPanels, type VoicedQuestionPanelDevice } from "../ui/voice-box/voiced-question-panels.js";
import { ConfirmPopups, type ConfirmPanelDevice } from "../ui/confirm-popups.js";
import { DraftPopups, type DraftPopupDevice } from "../ui/draft-popups.js";
import { LatestReply } from "../ui/latest-reply.js";
import { PermissionPopups, type PopupDevice } from "../ui/permission-popups.js";
import { QuestionPopups } from "../ui/question-popups.js";
import { LiveClients } from "../ui/server/live-clients.js";
import type { ProfileBrowser } from "../ui/server/link-actions.js";
import { PageOpener, type BrowserPage } from "../ui/server/page-opener.js";
import { LinkedNoticePanel } from "../ui/notices/linked-notice-panel.js";
import { ShownTaskSilence } from "../ui/notices/shown-task-silence.js";
import { TaskNotices, type NoticePanelDevice } from "../ui/notices/task-notices.js";
import { AfterTalking } from "../voice/after-talking.js";
import { ApprovalVoice, type VoiceApprovals } from "../voice/approval-voice.js";
import { VoiceAnswerChain } from "../voice/voice-answer-chain.js";
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
import { commandExplanations, commandReviews } from "./permission-models.js";
import { buildQuestions, type QuestionParts } from "./build-questions.js";
import { buildReplies, type ReplyParts } from "./build-replies.js";
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
  /** In auto mode, a model reads each call that would ask you and runs the routine ones (one extra model call each). */
  reviewCommands: boolean;
  /**
   * Name each new session's tab after its first task's main subject (one extra model call per session),
   * and announce each finished task by its topic and what got done (one extra model call per finished task).
   */
  nameSessions: boolean;
  /** Native pop-ups for permission requests. */
  popups: PopupDevice;
  /** Native pop-ups for a worker's questions. */
  questionPanels: VoicedQuestionPanelDevice;
  /** Native pop-ups for the assistant's confirm phrases. */
  confirmPanels: ConfirmPanelDevice;
  /** The small silent pop-up for each new drafted Slack or Telegram reply. */
  draftPopups: DraftPopupDevice;
  /** The native chat pop-up with your dialogue with the assistant, brought up by each finished reply. */
  chatPanels: VoicedChatPanelDevice;
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
  replies: ReplyParts;
}

/** Builds everything; the operator listens to events before the timeline and the chats do. */
export function buildApp(cfg: AppConfig, adapters: Adapters): App {
  const routes = voiceRoutes(() => [permissions.spoken, replies.spoken]); // permission answers come first
  const devices = { ...adapters, voice: routedVoice(adapters, routes, () => ui.tasks) };
  const core = buildCore(cfg, adapters.destructive);
  const { permissions, replies } = approvalParts(core, adapters);
  const questions = buildQuestions(core);
  const workers = buildWorkers(core, toolCallGate(permissions, questions), workerModels(core, adapters));
  if (adapters.nameSessions) sessionTitles(core, adapters).follow(workers.chat);
  const todo = buildTodo(core, workers.intake);
  const editor = buildEditor(cfg.editor);
  const neighbors = { permissions, questions, workers, todo, devices, editor, replies, clients: new LiveClients() };
  const operator = buildOperator(core, neighbors);
  const pages = new PageOpener(neighbors.clients, adapters.browser, () => ui.server.link());
  const actions = popupActionsFor(pages, operator);
  const notices = buildNotices(workers.summarizer, actions);
  const ui = buildUi(core, { ...neighbors, notices, links: adapters.chromeLinks, front: routes.front }, operator);
  const app = { core, permissions, questions, workers, todo, operator, ui, editor, notices, replies };
  showNatively(app, devices, actions);
  return app;
}

/** Where your words can go besides the assistant: the project tab in front, or a waiting permission request. */
interface VoiceRoutes {
  front: FrontSession;
  approvals: VoiceApprovals;
}

/**
 * Your voice, where a message that only says "allow" or "deny" answers a waiting request, and a message started while
 * a project tab is in front goes to its worker as a task. The tasks come from the web UI, built after the operator.
 */
function routedVoice(adapters: Adapters, { front, approvals }: VoiceRoutes, tasks: () => TaskActions): WorkerVoice {
  const voice = new ApprovalVoice(adapters.voice, front, approvals);
  return new WorkerVoice(voice, front, (session, text) => tasks().runTask(session, { instruction: text }));
}

/**
 * Spoken whole-message answers ("allow", "confirm send") act on the permissions and drafted replies, which are built
 * after the voice; the first in the list that can answer does.
 */
function voiceRoutes(answerers: () => VoiceApprovals[]): VoiceRoutes {
  const chain = (): VoiceAnswerChain => new VoiceAnswerChain(answerers());
  const approvals: VoiceApprovals = {
    canAnswer: (words) => chain().canAnswer(words),
    answer: (words, sessionInFront) => chain().answer(words, sessionInFront),
  };
  return { front: new FrontSession(), approvals };
}

/** What you approve: workers' permission requests, and replies to send to Slack and Telegram. */
function approvalParts(core: Core, adapters: Adapters): { permissions: PermissionParts; replies: ReplyParts } {
  const permissions = buildPermissions(core, commandExplanations(core, adapters), commandReviews(core, adapters));
  return { permissions, replies: buildReplies(core.cfg, core.messengers, adapters) };
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
 * so you see them from any app; none for quiet sessions. A task ending in the session on screen gets neither panel nor voice.
 */
function showNatively({ core, ui, notices, operator, replies }: App, adapters: Adapters, actions: PopupActions): void {
  const permissionPopups = new PermissionPopups(adapters.popups, ui.permissionClicks, actions);
  permissionPopups.follow(core.audibleEvents);
  const noticePanel = new LinkedNoticePanel(adapters.notices, () => ui.server.noticeLink());
  const afterTalking = new AfterTalking(adapters.voice);
  new TaskNotices(noticePanel, notices.inbox, notices.shownSessions).follow(core.audibleEvents, afterTalking);
  new ShownTaskSilence(notices.shownSessions, operator.voices).follow(core.audibleEvents);
  const questionPanels = new VoicedQuestionPanels(adapters.questionPanels, ui.boxes.panels);
  new QuestionPopups(questionPanels, ui.questionClicks, actions).follow(core.audibleEvents);
  const latestReply = new LatestReply();
  latestReply.follow(operator.lines);
  const confirmPopups = new ConfirmPopups(adapters.confirmPanels, operator.clickedWords, permissionPopups);
  confirmPopups.follow(operator.confirmAsk, latestReply);
  const chatPanels = new VoicedChatPanels(adapters.chatPanels, ui.boxes.panels, operator.spokenMessages);
  const chatPopup = new AssistantChatPopup(chatPanels, operator.clickedWords, operator.confirmAsk);
  chatPopup.follow(operator.lines, operator.context);
  const openDraft = async (draftId: string): Promise<void> => actions.openPage({ view: "messages", draftId });
  new DraftPopups(adapters.draftPopups, openDraft, replies.rules).follow(replies.news);
}

/** The operator's model session starts, then it listens for your voice. */
export async function startOperator(app: App, voice: OperatorDevices["voice"]): Promise<void> {
  app.operator.session.start();
  await voice.start();
}
