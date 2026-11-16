import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { BranchCompare } from "../review/branch-compare.js";
import { GitChanges } from "../review/git-changes.js";
import { GitDefinitions } from "../review/git-definitions.js";
import { ProjectRepositories } from "../review/project-repositories.js";
import { ChatFiles } from "../ui/chat-files.js";
import { Feed } from "../ui/feed.js";
import type { FrontSession } from "../ui/front-session.js";
import { ActionReporter } from "../ui/server/action-reporter.js";
import { ApiRoutes } from "../ui/server/api-routes.js";
import { AppActions } from "../ui/server/app-actions.js";
import { AssistantActions } from "../ui/server/assistant-actions.js";
import { AttachedText } from "../ui/server/attached-text.js";
import { ChangeActions } from "../ui/server/change-actions.js";
import { ChangesRoutes } from "../ui/server/changes-routes.js";
import { CompareRoutes } from "../ui/server/compare-routes.js";
import { DefinitionRoutes } from "../ui/server/definition-routes.js";
import { EditorStateView } from "../ui/server/editor-state-view.js";
import { FrontSessionActions } from "../ui/server/front-session-actions.js";
import { HandoffActions } from "../ui/server/handoff-actions.js";
import { LinkActions, type ProfileBrowser } from "../ui/server/link-actions.js";
import { GetRoutes } from "../ui/server/get-routes.js";
import type { LiveClients } from "../ui/server/live-clients.js";
import { relayToClients } from "../ui/server/live-relay.js";
import { NoticeStateView } from "../ui/server/notice-state-view.js";
import { WebManifest } from "../ui/server/web-manifest.js";
import { PageFiles } from "../ui/server/page-files.js";
import { PageStateView } from "../ui/server/page-state-view.js";
import { PermissionActions } from "../ui/server/permission-actions.js";
import { QueueActions } from "../ui/server/queue-actions.js";
import { QuestionActions } from "../ui/server/question-actions.js";
import { ReadRoutes, SessionChatReader } from "../ui/server/read-routes.js";
import { RepositoryLookup } from "../ui/server/repository-lookup.js";
import { ReviewRoutes } from "../ui/server/review-routes.js";
import { RouteTable, type RouteHandlers } from "../ui/server/route-table.js";
import { SessionActions } from "../ui/server/session-actions.js";
import { SessionModelActions } from "../ui/server/session-model-actions.js";
import { SessionSweepActions } from "../ui/server/session-sweep-actions.js";
import { SiteRouter } from "../ui/server/site-router.js";
import { StatePublisher } from "../ui/server/state-publisher.js";
import { TabActions } from "../ui/server/tab-actions.js";
import { TaskActions } from "../ui/server/task-actions.js";
import { UiAccess } from "../ui/server/ui-access.js";
import { UiLookup } from "../ui/server/ui-lookup.js";
import { UiRouter } from "../ui/server/ui-router.js";
import { UiServer } from "../ui/server/ui-server.js";
import { UiStateView } from "../ui/server/ui-state-view.js";
import { TodayBudget } from "../ui/server/today-budget.js";
import { WaitingViews } from "../ui/server/waiting-views.js";
import { SessionChats } from "../ui/session-chats.js";
import type { OperatorParts } from "./build-operator.js";
import { todoItemHandlers, todoItemViews } from "./build-todo.js";
import { askedReads } from "./build-asked-reads.js";
import type { Core } from "./core.js";
import type { NoticeParts } from "./build-notices.js";
import { voiceBoxes, voiceHandlers, voiceViews, type VoiceBoxes } from "./build-ui-voice.js";
import type { OperatorNeighbors } from "./operator-types.js";

export interface UiParts {
  server: UiServer;
  feed: Feed;
  chats: SessionChats;
  /** Answers by click, as the web UI's buttons do; pop-ups answer through it too. */
  permissionClicks: PermissionActions;
  /** Answers a worker's questions by click, as the web UI's dialog does; pop-ups answer through it too. */
  questionClicks: QuestionActions;
  /** The open pages, for messages that aren't about the state or a chat. */
  clients: LiveClients;
  /** Tasks sent straight to a session, typed in its message box or spoken while its project tab is in front. */
  tasks: TaskActions;
  /** The pages' message boxes, which your words go into while you talk. */
  boxes: VoiceBoxes;
}

/**
 * What the web UI shows and acts on besides the operator's neighbors: the notice panel's notices, Chrome for links, and
 * the project tab in front, which the page reports.
 */
export type UiNeighbors = OperatorNeighbors & { notices: NoticeParts; links: ProfileBrowser; front: FrontSession };

/** The assistant's timeline and the session chats follow the app; the web UI shows them. */
export function buildUi(core: Core, neighbors: UiNeighbors, operator: OperatorParts): UiParts {
  const feed = new Feed();
  feed.follow(operator.lines, core.events);
  const chats = new SessionChats(new ChatFiles(resolve(STATE_DIR, "chats")));
  chats.follow(neighbors.workers.chat, core.events);
  const reporter = new ActionReporter(feed, operator.orchestrator);
  const { answers, views } = neighbors.permissions;
  const permissionClicks = new PermissionActions(answers, views, reporter);
  const waiting = new WaitingViews(views, neighbors.questions.waiting, core.sessions);
  const questionClicks = new QuestionActions(neighbors.questions.replies, waiting, reporter);
  const lookup = new UiLookup(core.projects, core.sessions, core.cfg);
  const { clients } = neighbors;
  const changes = new GitChanges();
  const clicks = { permissionClicks, questionClicks };
  const tasks = new TaskActions(neighbors.workers.intake, lookup, reporter);
  const boxes = voiceBoxes(clients, neighbors.front, neighbors.devices.mic);
  const sources = { operator, feed, chats, reporter, ...clicks, waiting, lookup, clients, changes, tasks, boxes };
  return { server: uiServer(core, neighbors, sources), feed, chats, ...clicks, clients, tasks, boxes };
}

interface UiSources {
  operator: OperatorParts;
  feed: Feed;
  chats: SessionChats;
  reporter: ActionReporter;
  permissionClicks: PermissionActions;
  questionClicks: QuestionActions;
  waiting: WaitingViews;
  lookup: UiLookup;
  clients: LiveClients;
  changes: GitChanges;
  tasks: TaskActions;
  boxes: VoiceBoxes;
}

function uiServer(core: Core, neighbors: UiNeighbors, sources: UiSources): UiServer {
  const access = new UiAccess();
  const { clients, lookup } = sources;
  relayToClients(clients, sources.feed, sources.chats);
  const live = new UiStateView(lookup, sources.waiting, voiceViews(sources.operator, neighbors.devices));
  const budget = new TodayBudget(core.cfg.budget, neighbors.workers.spend);
  const page = new PageStateView(live, budget, todoItemViews(neighbors.todo));
  const state = new NoticeStateView(new EditorStateView(page, neighbors.editor.server), neighbors.notices.inbox);
  const publisher = new StatePublisher(clients, state, sources.feed);
  const table = routeTable(core, neighbors, sources);
  const reads = new ReadRoutes(access, publisher, new SessionChatReader(lookup, sources.chats));
  const review = reviewRoutes(access, lookup, sources.changes);
  const gets = new GetRoutes(new PageFiles(access, core.attachments, new WebManifest(access)), reads, review);
  const asked = askedReads(core, access, neighbors.devices.wakeTraining);
  const router = new UiRouter(gets, new ApiRoutes(access, table, publisher), asked);
  return new UiServer(new SiteRouter(neighbors.editor.route, router), publisher, access);
}

/** The Review view's reads: uncommitted changes, branch comparisons and where names are defined. */
function reviewRoutes(access: UiAccess, lookup: UiLookup, changes: GitChanges): ReviewRoutes {
  const changesRoutes = new ChangesRoutes(access, lookup, changes);
  const definitions = new DefinitionRoutes(access, lookup, new GitDefinitions());
  const repositories = new RepositoryLookup(lookup, new ProjectRepositories());
  return new ReviewRoutes(changesRoutes, definitions, new CompareRoutes(access, repositories, new BranchCompare()));
}

/** What each of the page's actions acts on. */
function routeTable(core: Core, neighbors: UiNeighbors, sources: UiSources): RouteTable {
  const { permissions, workers, todo, devices, notices } = neighbors;
  const { reporter, lookup } = sources;
  return new RouteTable({
    app: new AppActions(sources.operator.lifecycle),
    assistant: new AssistantActions(sources.operator.orchestrator, sources.feed, sources.operator.clickedWords),
    attached: new AttachedText(core.attachments),
    handoffs: new HandoffActions(workers.handoff, lookup, reporter),
    ...projectHandlers(neighbors, sources),
    ...noticeHandlers(notices),
    policy: permissions.policy,
    permissions: sources.permissionClicks,
    questions: sources.questionClicks,
    queue: new QueueActions(workers.queuedTasks, lookup, reporter),
    ...taskHandlers(neighbors, sources),
    todoItems: todoItemHandlers(todo, lookup, reporter),
    ...sessionHandlers(core, neighbors, sources),
    ...voiceHandlers(sources.operator, devices, sources.boxes),
  });
}

/** Tasks sent straight to a session, and where a page says which project tab is in front for your voice. */
function taskHandlers({ front }: UiNeighbors, { tasks }: UiSources): Pick<RouteHandlers, "tasks" | "frontSession"> {
  return { tasks, frontSession: new FrontSessionActions(front) };
}

/** What a project's Review view and the links in its chats act on. */
function projectHandlers(
  { links }: UiNeighbors,
  { lookup, changes }: UiSources,
): Pick<RouteHandlers, "changes" | "links"> {
  return { changes: new ChangeActions(lookup, changes), links: new LinkActions(lookup, links) };
}

/** What the notice panel's buttons act on, and where a page says which session it has on screen. */
function noticeHandlers({ actions, shownSessions }: NoticeParts): Pick<RouteHandlers, "notices" | "shownSessions"> {
  return { notices: actions, shownSessions };
}

/** What the session tabs, their buttons and their right-click menu act on. */
function sessionHandlers(
  core: Core,
  { workers }: OperatorNeighbors,
  { reporter, lookup }: UiSources,
): Pick<RouteHandlers, "tabs" | "sessions" | "models" | "sweeps"> {
  return {
    tabs: new TabActions(core.registry, lookup, reporter),
    sessions: new SessionActions(workers.control, lookup, reporter),
    models: new SessionModelActions(workers.models, lookup, reporter),
    sweeps: new SessionSweepActions(workers.control, lookup, reporter),
  };
}
