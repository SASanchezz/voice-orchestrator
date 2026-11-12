import type { AppConfig } from "../config/app-config.js";
import { CommandExplainer } from "../permissions/command-explainer.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import type { ExplainCommand } from "../permissions/permission-types.js";
import type { PopupActions } from "../ui/popup-actions.js";
import { ConfirmPopups, type ConfirmPanelDevice } from "../ui/confirm-popups.js";
import { PermissionPopups, type PopupDevice } from "../ui/permission-popups.js";
import { QuestionPopups, type QuestionPanelDevice } from "../ui/question-popups.js";
import { LiveClients } from "../ui/server/live-clients.js";
import { PageOpener, type BrowserPage } from "../ui/server/page-opener.js";
import { LinkedNoticePanel } from "../ui/notices/linked-notice-panel.js";
import { TaskNotices, type NoticePanelDevice } from "../ui/notices/task-notices.js";
import { AfterTalking } from "../voice/after-talking.js";
import { VoiceWithDictation } from "../voice/voice-with-dictation.js";
import { ToolCallGate } from "../workers/tool-call-gate.js";
import { buildEditor, type EditorParts } from "./build-editor.js";
import { buildNotices, popupActionsFor, type NoticeParts } from "./build-notices.js";
import { buildOperator, type OperatorParts } from "./build-operator.js";
import { buildPermissions, type PermissionParts } from "./build-permissions.js";
import { buildQuestions, type QuestionParts } from "./build-questions.js";
import { buildTodo, type TodoParts } from "./build-todo.js";
import { buildUi, type UiParts } from "./build-ui.js";
import { buildWorkers, type WorkerParts } from "./build-workers.js";
import { buildCore, type Core } from "./core.js";
import type { OperatorDevices } from "./operator-types.js";

/** The app's ties to the outside world; tests pass fakes. */
export interface Adapters extends OperatorDevices {
  destructive: DestructiveList;
  /** Explain each permission request in plain words on its card and pop-up (one extra model call each). */
  explainCommands: boolean;
  /** Native pop-ups for permission requests. */
  popups: PopupDevice;
  /** Native pop-ups for a worker's questions. */
  questionPanels: QuestionPanelDevice;
  /** Native pop-ups for the assistant's confirm phrases. */
  confirmPanels: ConfirmPanelDevice;
  /** The native notice panel, where ended tasks wait to be read and replied to. */
  notices: NoticePanelDevice;
  /** The web UI's page in your browser, brought to the front from a notice. */
  browser: BrowserPage;
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
  const devices = { ...adapters, voice: new VoiceWithDictation(adapters.voice, adapters.dictation) };
  const core = buildCore(cfg, adapters.destructive);
  const permissions = buildPermissions(core, commandExplanations(core, adapters));
  const questions = buildQuestions(core);
  const workers = buildWorkers(core, new ToolCallGate(permissions.broker, questions.broker), adapters.query);
  const todo = buildTodo(core, workers.intake);
  const editor = buildEditor(cfg.editor);
  const neighbors = { permissions, questions, workers, todo, devices, editor, clients: new LiveClients() };
  const operator = buildOperator(core, neighbors);
  const pages = new PageOpener(neighbors.clients, adapters.browser, () => ui.server.link());
  const actions = popupActionsFor(pages, operator);
  const notices = buildNotices(workers.summarizer, actions);
  const ui = buildUi(core, { ...neighbors, notices }, operator);
  const app = { core, permissions, questions, workers, todo, operator, ui, editor, notices };
  showNatively(app, devices, actions);
  return app;
}

/** Plain-language explanations of commands, when the adapters want them. */
function commandExplanations(core: Core, adapters: Adapters): ExplainCommand | undefined {
  if (!adapters.explainCommands) return undefined;
  const explainer = new CommandExplainer(core.cfg, core.projects, adapters.query);
  return (project, command) => explainer.explain(project, command);
}

/**
 * Native pop-ups for requests, questions and the assistant's confirm phrases, and the notice panel when a task ends,
 * so you see them from any app; none for quiet sessions.
 */
function showNatively({ core, ui, notices, operator }: App, adapters: Adapters, actions: PopupActions): void {
  const permissionPopups = new PermissionPopups(adapters.popups, ui.permissionClicks);
  permissionPopups.follow(core.audibleEvents);
  const noticePanel = new LinkedNoticePanel(adapters.notices, () => ui.server.noticeLink());
  const afterTalking = new AfterTalking(adapters.voice);
  new TaskNotices(noticePanel, notices.inbox, notices.shownSessions).follow(core.audibleEvents, afterTalking);
  new QuestionPopups(adapters.questionPanels, ui.questionClicks, actions).follow(core.audibleEvents);
  const confirmPopups = new ConfirmPopups(adapters.confirmPanels, operator.clickedWords, permissionPopups);
  confirmPopups.follow(operator.confirmAsk, operator.lines);
}

/** The operator's model session starts, then it listens for your voice. */
export async function startOperator(app: App, voice: OperatorDevices["voice"]): Promise<void> {
  app.operator.session.start();
  await voice.start();
}
