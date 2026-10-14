import { resolve } from "node:path";
import type { QueryFn } from "../agent/query-fn.js";
import { STATE_DIR } from "../config/paths.js";
import { TodoList } from "../limits/todo-list.js";
import { UsageLimits } from "../limits/usage-limits.js";
import { MeteredStream } from "../budget/metered-stream.js";
import type { DailySpend } from "../budget/daily-spend.js";
import { ChangeSummarizer } from "../workers/change-summarizer.js";
import { HandoffWriter } from "../workers/handoff-writer.js";
import { LimitParking } from "../workers/limit-parking.js";
import { SessionControl } from "../workers/session-control.js";
import { SessionHandoff } from "../workers/session-handoff.js";
import { SessionQueue } from "../workers/session-queue.js";
import { SessionRuns } from "../workers/session-runs.js";
import { SessionSuccessor } from "../workers/session-successor.js";
import { TaskAnnouncer } from "../workers/task-announcer.js";
import { TaskIntake } from "../workers/task-intake.js";
import { TaskLauncher } from "../workers/task-launcher.js";
import { TaskOutcomes } from "../workers/task-outcomes.js";
import { TaskRecorder } from "../workers/task-recorder.js";
import { TaskRunner } from "../workers/task-runner.js";
import { TaskStream } from "../workers/task-stream.js";
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
  todos: TodoRunner;
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
}

export function buildWorkers(core: Core, gate: ToolCallGate, query: QueryFn): WorkerParts {
  const kit = workerKit(core);
  const runner = taskRunner(core, kit, new TaskLauncher(kit.options, gate, query));
  const runs = new SessionRuns(new SessionQueue(core.sessions), kit.directory, runner);
  const intake = new TaskIntake(kit.directory, runs, kit.chat);
  const writer = new HandoffWriter(kit.options, query, kit.budget.ledger);
  const successor = new SessionSuccessor(core.registry, core.sessions, kit.chat);
  return {
    chat: kit.chat,
    intake,
    control: new SessionControl(core.registry, kit.directory, runs),
    todos: new TodoRunner(kit.todo, kit.limits, intake),
    summarizer: new ChangeSummarizer(kit.options, kit.directory, query),
    handoff: new SessionHandoff(writer, runs, successor),
    spend: kit.budget.daily,
    todo: kit.todo,
  };
}

function workerKit(core: Core): WorkerKit {
  const { cfg, projects, sessions, events, destructive } = core;
  const directory = new WorkerDirectory(cfg, projects, sessions);
  const todo = new TodoList(resolve(STATE_DIR, "todo"));
  const options = new WorkerOptions(cfg, directory, destructive);
  const chat = new WorkerChat();
  return { chat, directory, options, todo, limits: new UsageLimits(todo, events), budget: buildBudget(core, chat) };
}

function taskRunner({ sessions, history, events }: Core, kit: WorkerKit, launcher: TaskLauncher): TaskRunner {
  const { chat, directory, limits, budget } = kit;
  const outcomes = new TaskOutcomes(
    new TaskRecorder(sessions, history, budget.ledger),
    new TaskAnnouncer(events, chat, directory),
    new LimitParking(limits, sessions, chat),
  );
  const stream = new TaskStream(sessions, new WorkerActivity(sessions, chat), outcomes);
  return new TaskRunner(launcher, new MeteredStream(stream, budget.meter), outcomes);
}
