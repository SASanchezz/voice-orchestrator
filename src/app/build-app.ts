import type { AppConfig } from "../config/app-config.js";
import { CommandExplainer } from "../permissions/command-explainer.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import type { ExplainCommand } from "../permissions/permission-types.js";
import type { PopupActions } from "../ui/popup-actions.js";
import { PermissionPopups, type PopupDevice } from "../ui/permission-popups.js";
import { QuestionPopups, type QuestionPanelDevice } from "../ui/question-popups.js";
import { PageOpener, type BrowserPage } from "../ui/server/page-opener.js";
import { TaskNotices, type NoticeDevice } from "../ui/task-notices.js";
import { ToolCallGate } from "../workers/tool-call-gate.js";
import { buildOperator, type OperatorParts } from "./build-operator.js";
import { buildPermissions, type PermissionParts } from "./build-permissions.js";
import { buildQuestions, type QuestionParts } from "./build-questions.js";
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
  /** Native notices when a task ends. */
  notices: NoticeDevice;
  /** The web UI's page in your browser, brought to the front from a notice. */
  browser: BrowserPage;
}

export interface App {
  core: Core;
  permissions: PermissionParts;
  questions: QuestionParts;
  workers: WorkerParts;
  operator: OperatorParts;
  ui: UiParts;
}

/** Builds everything; the operator listens to events before the timeline and the chats do. */
export function buildApp(cfg: AppConfig, adapters: Adapters): App {
  const core = buildCore(cfg, adapters.destructive);
  const permissions = buildPermissions(core, commandExplanations(core, adapters));
  const questions = buildQuestions(core);
  const workers = buildWorkers(core, new ToolCallGate(permissions.broker, questions.broker), adapters.query);
  const neighbors = { permissions, questions, workers, devices: adapters };
  const operator = buildOperator(core, neighbors);
  const ui = buildUi(core, neighbors, operator);
  const app = { core, permissions, questions, workers, operator, ui };
  showNatively(app, adapters);
  return app;
}

/** Plain-language explanations of commands, when the adapters want them. */
function commandExplanations(core: Core, adapters: Adapters): ExplainCommand | undefined {
  if (!adapters.explainCommands) return undefined;
  const explainer = new CommandExplainer(core.cfg, core.projects, adapters.query);
  return (project, command) => explainer.explain(project, command);
}

/** Native pop-ups for requests and questions, and a notice when a task ends, so you see them from any app. */
function showNatively({ core, ui, operator }: App, adapters: Adapters): void {
  new PermissionPopups(adapters.popups, ui.permissionClicks).follow(core.events);
  const pages = new PageOpener(ui.clients, adapters.browser, () => ui.server.link());
  const actions: PopupActions = {
    openPage: (target) => pages.open(target),
    silence: (event) => operator.voices.silence(event),
  };
  new TaskNotices(adapters.notices, actions).follow(core.events);
  new QuestionPopups(adapters.questionPanels, ui.questionClicks, actions).follow(core.events);
}

/** The operator's model session starts, then it listens for your voice. */
export async function startOperator(app: App, voice: OperatorDevices["voice"]): Promise<void> {
  app.operator.session.start();
  await voice.start();
}
