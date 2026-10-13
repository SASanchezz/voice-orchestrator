import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { ChatFiles } from "../ui/chat-files.js";
import { Feed } from "../ui/feed.js";
import { ActionReporter } from "../ui/server/action-reporter.js";
import { ApiRoutes } from "../ui/server/api-routes.js";
import { AssistantActions } from "../ui/server/assistant-actions.js";
import { LiveClients } from "../ui/server/live-clients.js";
import { relayToClients } from "../ui/server/live-relay.js";
import { PageFiles } from "../ui/server/page-files.js";
import { PermissionActions } from "../ui/server/permission-actions.js";
import { QuestionActions } from "../ui/server/question-actions.js";
import { ReadRoutes, SessionChatReader } from "../ui/server/read-routes.js";
import { RouteTable } from "../ui/server/route-table.js";
import { SessionActions } from "../ui/server/session-actions.js";
import { StatePublisher } from "../ui/server/state-publisher.js";
import { TabActions } from "../ui/server/tab-actions.js";
import { TaskActions } from "../ui/server/task-actions.js";
import { UiAccess } from "../ui/server/ui-access.js";
import { UiLookup } from "../ui/server/ui-lookup.js";
import { UiRouter } from "../ui/server/ui-router.js";
import { UiServer } from "../ui/server/ui-server.js";
import { UiStateView } from "../ui/server/ui-state-view.js";
import { WaitingViews } from "../ui/server/waiting-views.js";
import { SessionChats } from "../ui/session-chats.js";
import type { OperatorParts } from "./build-operator.js";
import type { Core } from "./core.js";
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
}

/** The assistant's timeline and the session chats follow the app; the web UI shows them. */
export function buildUi(core: Core, neighbors: OperatorNeighbors, operator: OperatorParts): UiParts {
  const feed = new Feed();
  feed.follow(operator.lines, core.events);
  const chats = new SessionChats(new ChatFiles(resolve(STATE_DIR, "chats")));
  chats.follow(neighbors.workers.chat, core.events);
  const reporter = new ActionReporter(feed, operator.orchestrator);
  const { answers, views } = neighbors.permissions;
  const permissionClicks = new PermissionActions(answers, views, reporter);
  const waiting = new WaitingViews(views, neighbors.questions.waiting, core.sessions);
  const questionClicks = new QuestionActions(neighbors.questions.replies, waiting, reporter);
  const lookup = new UiLookup(core.projects, core.sessions, core.cfg.projects);
  const clients = new LiveClients();
  const sources = { operator, feed, chats, reporter, permissionClicks, questionClicks, waiting, lookup, clients };
  return { server: uiServer(core, neighbors, sources), feed, chats, permissionClicks, questionClicks, clients };
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
}

function uiServer(core: Core, neighbors: OperatorNeighbors, sources: UiSources): UiServer {
  const { orchestrator } = sources.operator;
  const access = new UiAccess();
  const { clients, lookup } = sources;
  relayToClients(clients, sources.feed, sources.chats);
  const publisher = new StatePublisher(clients, new UiStateView(lookup, sources.waiting, orchestrator), sources.feed);
  const table = routeTable(core, neighbors, sources);
  const reads = new ReadRoutes(access, publisher, new SessionChatReader(lookup, sources.chats));
  const router = new UiRouter(new PageFiles(access), reads, new ApiRoutes(access, table, publisher));
  return new UiServer(router, publisher, access);
}

/** What each of the page's actions acts on. */
function routeTable(core: Core, { permissions, workers }: OperatorNeighbors, sources: UiSources): RouteTable {
  const { reporter, lookup } = sources;
  return new RouteTable({
    assistant: new AssistantActions(sources.operator.orchestrator, sources.feed),
    policy: permissions.policy,
    permissions: sources.permissionClicks,
    questions: sources.questionClicks,
    tabs: new TabActions(core.registry, lookup, reporter),
    tasks: new TaskActions(workers.intake, lookup, reporter),
    sessions: new SessionActions(workers.control, lookup, reporter),
  });
}
