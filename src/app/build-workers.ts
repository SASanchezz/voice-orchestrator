import { resolve } from "node:path";
import type { QueryFn } from "../agent/query-fn.js";
import { STATE_DIR } from "../config/paths.js";
import { TodoList } from "../limits/todo-list.js";
import { UsageLimits } from "../limits/usage-limits.js";
import type { PermissionBroker } from "../permissions/permission-broker.js";
import { ChangeSummarizer } from "../workers/change-summarizer.js";
import { LimitParking } from "../workers/limit-parking.js";
import { SessionControl } from "../workers/session-control.js";
import { SessionQueue } from "../workers/session-queue.js";
import { SessionRuns } from "../workers/session-runs.js";
import { TaskAnnouncer } from "../workers/task-announcer.js";
import { TaskIntake } from "../workers/task-intake.js";
import { TaskLauncher } from "../workers/task-launcher.js";
import { TaskOutcomes } from "../workers/task-outcomes.js";
import { TaskRecorder } from "../workers/task-recorder.js";
import { TaskRunner } from "../workers/task-runner.js";
import { TaskStream } from "../workers/task-stream.js";
import { TodoRunner } from "../workers/todo-runner.js";
import { WorkerActivity } from "../workers/worker-activity.js";
import { WorkerChat } from "../workers/worker-chat.js";
import { WorkerDirectory } from "../workers/worker-directory.js";
import { WorkerOptions } from "../workers/worker-options.js";
import type { Core } from "./core.js";

export interface WorkerParts {
  chat: WorkerChat;
  intake: TaskIntake;
  control: SessionControl;
  todos: TodoRunner;
  summarizer: ChangeSummarizer;
  /** The todo folder itself, for tests. */
  todo: TodoList;
}

/** What the worker classes share. */
interface WorkerKit {
  chat: WorkerChat;
  directory: WorkerDirectory;
  options: WorkerOptions;
  todo: TodoList;
  limits: UsageLimits;
}

export function buildWorkers(core: Core, broker: PermissionBroker, query: QueryFn): WorkerParts {
  const kit = workerKit(core);
  const runner = taskRunner(core, kit, new TaskLauncher(kit.options, broker, query));
  const runs = new SessionRuns(new SessionQueue(core.sessions), kit.directory, runner);
  const intake = new TaskIntake(kit.directory, runs, kit.chat);
  return {
    chat: kit.chat,
    intake,
    control: new SessionControl(core.registry, kit.directory, runs),
    todos: new TodoRunner(kit.todo, kit.limits, intake),
    summarizer: new ChangeSummarizer(kit.options, kit.directory, query),
    todo: kit.todo,
  };
}

function workerKit({ cfg, projects, sessions, events, destructive }: Core): WorkerKit {
  const directory = new WorkerDirectory(cfg, projects, sessions);
  const todo = new TodoList(resolve(STATE_DIR, "todo"));
  const options = new WorkerOptions(cfg, directory, destructive);
  return { chat: new WorkerChat(), directory, options, todo, limits: new UsageLimits(todo, events) };
}

function taskRunner({ sessions, history, events }: Core, kit: WorkerKit, launcher: TaskLauncher): TaskRunner {
  const { chat, directory, limits } = kit;
  const outcomes = new TaskOutcomes(
    new TaskRecorder(sessions, history),
    new TaskAnnouncer(events, chat, directory),
    new LimitParking(limits, sessions, chat),
  );
  return new TaskRunner(launcher, new TaskStream(sessions, new WorkerActivity(sessions, chat), outcomes), outcomes);
}
