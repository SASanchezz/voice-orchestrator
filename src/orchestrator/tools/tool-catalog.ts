import type { AttachmentFiles } from "../../attachments/attachment-files.js";
import type { AppConfig } from "../../config/app-config.js";
import type { PermissionAnswers } from "../../permissions/permission-answers.js";
import type { PermissionPolicy } from "../../permissions/permission-policy.js";
import type { PermissionViews } from "../../permissions/permission-views.js";
import type { Registry } from "../../registry/registry.js";
import type { StatusReport } from "../../registry/status-report.js";
import type { TaskHistory } from "../../registry/task-history.js";
import type { Editor } from "../../editor/editor.js";
import type { DestructiveList } from "../../safety/destructive-list.js";
import type { ScreenSource } from "../../screen/screen-source.js";
import type { GestureControl } from "../../sensors/gesture-switch.js";
import type { ChangeSummarizer } from "../../workers/change-summarizer.js";
import type { QueuedTasks } from "../../workers/queued-tasks.js";
import type { SessionControl } from "../../workers/session-control.js";
import type { TaskIntake } from "../../workers/task-intake.js";
import type { TodoItemSender } from "../../todo-items/todo-item-sender.js";
import type { TodoItems } from "../../todo-items/todo-items.js";
import type { TodoTrash } from "../../todo-items/todo-trash.js";
import type { TodoRunner } from "../../workers/todo-runner.js";
import type { AccountSwitch } from "../actions/account-switch.js";
import type { GitCommands } from "../actions/git-commands.js";
import type { ProjectOpener } from "../actions/project-opener.js";
import type { ProjectRemover } from "../actions/project-remover.js";
import type { TurnContext } from "../conversation/turn-context.js";
import type { ResetRequests } from "../lifecycle/reset-requests.js";
import type { AssistantNotes } from "../memory/assistant-notes.js";
import { lookAtCamera, lookAtScreen, remember, resetContext, restartOrchestrator } from "./assistant-tools.js";
import type { CameraView } from "./camera-views.js";
import { readAttachment } from "./attachment-tools.js";
import { destructiveAdd, destructiveRemove, destructiveRules } from "./destructive-tools.js";
import { setGestures } from "./gesture-tools.js";
import { showChat, showCode, type PageClients } from "./page-view-tools.js";
import { answerPermission, listPendingPermissions, setPermissionMode } from "./permission-tools.js";
import {
  listProjects,
  openProject,
  projectHistory,
  projectStatus,
  removeProject,
  setProjectAccount,
} from "./project-tools.js";
import { listQueuedTasks, removeQueuedTask } from "./queue-tools.js";
import { closeSession, listSessions, newSession, switchSession } from "./session-tools.js";
import { git, runTask, stopTask, summarizeChanges } from "./task-tools.js";
import { deleteTodoItem, restoreTodoItem, sendTodoItem, setTodoItemDone } from "./todo-item-change-tools.js";
import { addTodoItem, editTodoItem, listTodoItems } from "./todo-item-tools.js";
import { discardTodo, listTodo, runTodo } from "./todo-tools.js";
import type { OperatorTool } from "./tool-kit.js";

/** Everything the operator's tools act on; each tool takes only the parts it uses. */
export interface ToolServices {
  cfg: AppConfig;
  registry: Registry;
  status: StatusReport;
  history: TaskHistory;
  opener: ProjectOpener;
  remover: ProjectRemover;
  accounts: AccountSwitch;
  intake: TaskIntake;
  control: SessionControl;
  queuedTasks: QueuedTasks;
  todos: TodoRunner;
  todoItems: TodoItems;
  todoTrash: TodoTrash;
  todoSender: TodoItemSender;
  summarizer: ChangeSummarizer;
  git: GitCommands;
  notes: AssistantNotes;
  requests: ResetRequests;
  policy: PermissionPolicy;
  answers: PermissionAnswers;
  views: PermissionViews;
  context: TurnContext;
  screen: ScreenSource;
  cameraView: CameraView;
  gestures: GestureControl;
  editor: Pick<Editor, "status">;
  clients: PageClients;
  attachments: AttachmentFiles;
  destructive: DestructiveList;
}

/** The tools in the order the model sees them. */
const CATALOG: ((s: ToolServices) => OperatorTool)[] = [
  (s) => listProjects(s.status),
  (s) => openProject(s.opener, s.cfg),
  (s) => removeProject(s.remover, s.context, s.cfg),
  (s) => projectStatus(s.status, s.cfg),
  (s) => listSessions(s.status, s.cfg),
  (s) => newSession(s.registry, s.cfg),
  (s) => switchSession(s.registry, s.cfg),
  (s) => closeSession(s.registry, s.control, s.cfg),
  (s) => runTask(s.intake, s.cfg),
  (s) => listTodo(s.todos),
  (s) => runTodo(s.todos),
  (s) => discardTodo(s.todos),
  (s) => listTodoItems(s.todoItems),
  (s) => addTodoItem(s.todoItems, s.cfg),
  (s) => editTodoItem(s.todoItems, s.cfg),
  (s) => setTodoItemDone(s.todoItems),
  (s) => deleteTodoItem(s.todoItems, s.todoTrash),
  (s) => restoreTodoItem(s.todoTrash),
  (s) => sendTodoItem(s.todoItems, s.todoSender, s.cfg),
  (s) => projectHistory(s.history, s.cfg),
  (s) => remember(s.notes),
  (s) => resetContext(s.requests),
  (s) => restartOrchestrator(s.requests),
  (s) => stopTask(s.control, s.registry, s.cfg),
  (s) => listQueuedTasks(s.queuedTasks, s.registry, s.cfg),
  (s) => removeQueuedTask(s.queuedTasks, s.registry, s.cfg),
  (s) => summarizeChanges(s.summarizer, s.cfg),
  (s) => git(s.git, s.cfg),
  (s) => listPendingPermissions(s.views),
  (s) => setPermissionMode(s.policy),
  (s) => answerPermission(s.answers, s.context),
  (s) => setProjectAccount(s.accounts, s.cfg),
  (s) => lookAtScreen(s.screen),
  (s) => lookAtCamera(s.cameraView),
  (s) => setGestures(s.gestures),
  (s) => showCode(s.clients, s.editor, s.cfg),
  (s) => showChat(s.clients, s.cfg),
  (s) => readAttachment(s.attachments),
  (s) => destructiveRules(s.destructive),
  (s) => destructiveAdd(s.destructive, s.context),
  (s) => destructiveRemove(s.destructive, s.context),
];

export function operatorToolList(services: ToolServices): OperatorTool[] {
  return CATALOG.map((make) => make(services));
}
