import { resolve } from "node:path";
import type { QueryFn } from "../agent/query-fn.js";
import { STATE_DIR } from "../config/paths.js";
import { TodoList } from "../limits/todo-list.js";
import { ResumePolicy } from "../limits/resume-policy.js";
import { UsageLimits } from "../limits/usage-limits.js";
import { MeteredStream } from "../budget/metered-stream.js";
import type { DailySpend } from "../budget/daily-spend.js";
import { ChangeSummarizer } from "../workers/change-summarizer.js";
import { HandoffWriter } from "../workers/handoff-writer.js";
import { LimitParking } from "../workers/limit-parking.js";
import { LimitResumer } from "../workers/limit-resumer.js";
import { QuietResume } from "../workers/quiet-resume.js";
import { SessionControl } from "../workers/session-control.js";
import { SessionHandoff } from "../workers/session-handoff.js";
import { SessionModels } from "../workers/session-models.js";
import { QueuedTasks } from "../workers/queued-tasks.js";
import { SessionQueue } from "../workers/session-queue.js";
import { SessionRuns } from "../workers/session-runs.js";
import { SessionSuccessor } from "../workers/session-successor.js";
import { TaskAnnouncer } from "../workers/task-announcer.js";
import { TaskIntake } from "../workers/task-intake.js";
import { TaskLauncher } from "../workers/task-launcher.js";
import { TaskNames } from "../workers/task-names.js";
import { TaskOutcomes } from "../workers/task-outcomes.js";
import { TaskRecorder } from "../workers/task-recorder.js";
import { TaskRunner } from "../workers/task-runner.js";
import { TaskStream } from "../workers/task-stream.js";
import type { TaskTopics } from "../workers/task-topics.js";
import { TodoRunner } from "../workers/todo-runner.js";
import type { ToolCallGate } from "../workers/tool-call-gate.js";
import { WorkerActivity } from "../workers/worker-activity.js";
import { WorkerChat } from "../workers/worker-chat.js";
import { WorkerDirectory } from "../workers/worker-directory.js";
import { WorkerOptions } from "../workers/worker-options.js";
import { type BudgetParts, buildBudget } from "./build-budget.js";
import type { Core } from "./core.js";

export interface WorkerParts {
  chat: WorkerChat;
  intake: TaskIntake;
  control: SessionControl;
  /** The model each session's worker runs on. */
  models: SessionModels;
  /** Sessions' queued instructions, to list them or drop one. */
  queuedTasks: QueuedTasks;
  todos: TodoRunner;
  /** Runs tasks saved by a usage limit again once it resets; started only with limits.autoResume. */
  resumer: LimitResumer;
  summarizer: ChangeSummarizer;
  handoff: SessionHandoff;
  /** What all workers spent each day. */
  spend: DailySpend;
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
  budget: BudgetParts;
  topics: TaskTopics;
}

/** The models workers reach: Claude Code for tasks, and whatever names a finished task's topic. */
export interface WorkerModels {
  query: QueryFn;
  topics: TaskTopics;
}

export function buildWorkers(core: Core, gate: ToolCallGate, { query, topics }: WorkerModels): WorkerParts {
  const kit = workerKit(core, topics);
  const runner = taskRunner(core, kit, new TaskLauncher(kit.options, gate, query));
  const queue = new SessionQueue(core.sessions);
  const runs = new SessionRuns(queue, kit.directory, runner);
  const intake = new TaskIntake(kit.directory, runs, kit.chat);
  const writer = new HandoffWriter(kit.options, query, kit.budget.ledger);
  const successor = new SessionSuccessor(core.registry, core.sessions, kit.chat);
  return {
    chat: kit.chat,
    intake,
    ...sessionParts(core, kit, runs),
    queuedTasks: new QueuedTasks(queue, kit.directory, kit.chat),
    ...todoParts(core, kit, intake),
    summarizer: new ChangeSummarizer(kit.options, query),
    handoff: new SessionHandoff(writer, runs, successor),
    spend: kit.budget.daily,
    todo: kit.todo,
  };
}

/** Stopping, closing and clearing sessions, and the model each one's worker runs on. */
function sessionParts(
  { registry, sessions }: Core,
  kit: WorkerKit,
  runs: SessionRuns,
): Pick<WorkerParts, "control" | "models"> {
  return {
    control: new SessionControl(registry, kit.directory, runs),
    models: new SessionModels(sessions, kit.directory, kit.chat),
  };
}

/** The todo list's runner, and the resumer that runs its tasks again once their limit resets. */
function todoParts(
  { cfg, registry, quiet }: Core,
  kit: WorkerKit,
  intake: TaskIntake,
): Pick<WorkerParts, "todos" | "resumer"> {
  const todos = new TodoRunner(kit.todo, kit.limits, intake);
  const quietResume = new QuietResume(todos, registry, quiet);
  return { todos, resumer: new LimitResumer(todos, new ResumePolicy(cfg.limits), quietResume) };
}

function workerKit(core: Core, topics: TaskTopics): WorkerKit {
  const { cfg, projects, sessions, events, workerRules } = core;
  const directory = new WorkerDirectory(cfg, projects, sessions);
  const todo = new TodoList(resolve(STATE_DIR, "todo"));
  const options = new WorkerOptions(cfg, directory, workerRules);
  const chat = new WorkerChat();
  const limits = new UsageLimits(todo, events);
  return { chat, directory, options, todo, limits, budget: buildBudget(core, chat), topics };
}

function taskRunner({ sessions, history, events }: Core, kit: WorkerKit, launcher: TaskLauncher): TaskRunner {
  const { chat, directory, limits, budget, topics } = kit;
  const outcomes = new TaskOutcomes(
    new TaskRecorder(sessions, history, budget.ledger),
    new TaskAnnouncer(events, chat, new TaskNames(directory, topics)),
    new LimitParking(limits, sessions, chat),
  );
  const stream = new TaskStream(sessions, new WorkerActivity(sessions, chat), outcomes);
  return new TaskRunner(launcher, new MeteredStream(stream, budget.meter), outcomes);
}
