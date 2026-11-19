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
import { ClosedConversations } from "../workers/closed-conversations.js";
import { SessionControl } from "../workers/session-control.js";
import { SessionHandoff } from "../workers/session-handoff.js";
import { SessionModels } from "../workers/session-models.js";
import { SessionReopener } from "../workers/session-reopener.js";
import { QueuedTasks } from "../workers/queued-tasks.js";
import { SessionQueue } from "../workers/session-queue.js";
import { SessionInbox } from "../workers/session-inbox.js";
import { SessionRuns } from "../workers/session-runs.js";
import { SessionSuccessor } from "../workers/session-successor.js";
import { SideQuestionWriter } from "../workers/side-question-writer.js";
import { SideQuestions } from "../workers/side-questions.js";
import { TaskAnnouncer } from "../workers/task-announcer.js";
import { TaskIntake } from "../workers/task-intake.js";
import { TaskLauncher } from "../workers/task-launcher.js";
import { TaskNames } from "../workers/task-names.js";
import { TaskOutcomes } from "../workers/task-outcomes.js";
import { TaskRecorder } from "../workers/task-recorder.js";
import { TaskRunner } from "../workers/task-runner.js";
import { TaskStream } from "../workers/task-stream.js";
import { BackgroundJobs } from "../workers/background-jobs.js";
import { JobWatchingStream } from "../workers/job-watching-stream.js";
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
  /** Tasks and /btw side questions you send a session yourself. */
  inbox: SessionInbox;
  control: SessionControl;
  /** Closed sessions Claude Code still keeps, and bringing one back. */
  closedSessions: ClosedConversations;
  reopener: SessionReopener;
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
  /** The background commands and helpers each session waits on. */
  backgroundJobs: BackgroundJobs;
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
  backgroundJobs: BackgroundJobs;
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
  const sending = sendingParts(kit, query, runs);
  const writer = new HandoffWriter(kit.options, query, kit.budget.ledger);
  const successor = new SessionSuccessor(core.registry, core.sessions, kit.chat);
  return {
    chat: kit.chat,
    ...sending,
    ...sessionParts(core, kit, runs),
    queuedTasks: new QueuedTasks(queue, kit.directory, kit.chat),
    ...todoParts(core, kit, sending.intake),
    summarizer: new ChangeSummarizer(kit.options, query),
    handoff: new SessionHandoff(writer, runs, successor),
    spend: kit.budget.daily,
    todo: kit.todo,
  };
}

/** Tasks for sessions, and /btw questions answered in a fork of the session's conversation, beside its running task. */
function sendingParts(kit: WorkerKit, query: QueryFn, runs: SessionRuns): Pick<WorkerParts, "intake" | "inbox"> {
  const intake = new TaskIntake(kit.directory, runs, kit.chat);
  const writer = new SideQuestionWriter(kit.options, query, kit.budget.ledger);
  return { intake, inbox: new SessionInbox(intake, new SideQuestions(kit.directory, writer, kit.chat)) };
}

/**
 * Stopping, closing, reopening and clearing sessions, the model each one's worker runs on, and what it runs in the
 * background.
 */
function sessionParts(
  { cfg, registry, projects, sessions }: Core,
  kit: WorkerKit,
  runs: SessionRuns,
): Pick<WorkerParts, "control" | "closedSessions" | "reopener" | "models" | "backgroundJobs"> {
  return {
    control: new SessionControl(registry, kit.directory, runs),
    closedSessions: new ClosedConversations(cfg, projects, sessions),
    reopener: new SessionReopener(registry, sessions, kit.chat),
    models: new SessionModels(sessions, kit.directory, kit.chat),
    backgroundJobs: kit.backgroundJobs,
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
  const backgroundJobs = new BackgroundJobs();
  return { chat, directory, options, todo, limits, budget: buildBudget(core, chat), topics, backgroundJobs };
}

function taskRunner({ sessions, history, events }: Core, kit: WorkerKit, launcher: TaskLauncher): TaskRunner {
  const { chat, directory, limits, budget, topics, backgroundJobs } = kit;
  const outcomes = new TaskOutcomes(
    new TaskRecorder(sessions, history, budget.ledger),
    new TaskAnnouncer(events, chat, new TaskNames(directory, topics)),
    new LimitParking(limits, sessions, chat),
  );
  const stream = new TaskStream(sessions, new WorkerActivity(sessions, chat), outcomes);
  const watched = new JobWatchingStream(stream, backgroundJobs);
  return new TaskRunner(launcher, new MeteredStream(watched, budget.meter), outcomes);
}
