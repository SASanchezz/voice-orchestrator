# How the Voice Orchestrator's assistant works

A guide for anyone new to this app: what the assistant is, how it decides where work goes, what it remembers and
where, and why it opens new sessions. The [README](README.md) describes features from the user's side; this file
explains the machinery behind them. Every claim points at the code that implements it, so you can check it.

## Contents

0. [Knowledge file map: which file holds what](#0-knowledge-file-map-which-file-holds-what)
1. [Architecture overview](#1-architecture-overview)
2. [Session management](#2-session-management)
3. [Notes and memory](#3-notes-and-memory)
4. [Routing logic](#4-routing-logic)
5. [Configuration](#5-configuration)
6. [Decision edges of the specialized agent](#6-decision-edges-of-the-specialized-agent)
7. [Validation and logging](#7-validation-and-logging)
8. [Token management](#8-token-management)
9. [Where everything lives (cheat sheet)](#9-where-everything-lives-cheat-sheet)
10. [Known gaps and inconsistencies](#10-known-gaps-and-inconsistencies)

---

## 0. Knowledge file map: which file holds what

The app has several Markdown files, plus a few data files that work like memory. They're easy to mix up,
`CLAUDE.md` and `config/notes.md` most of all. **The deciding question is: who reads the file?**

- **The assistant** (the voice operator) reads `agents/voice-assistant.md` and `config/notes.md`.
- **The workers and Claude Code sessions that edit this repo** read `CLAUDE.md`.
- **People** read `README.md`, this file, and `docs/`.

### Who reads what

```
                       ┌──────────────────────────── read by PEOPLE ───────────────────────────┐
                       │ README.md (user side)      SYSTEM_KNOWLEDGE.md (inside, this file)    │
                       │ docs/gestures-plan.md ◄──links── sensors/gestures/README.md           │
                       │ docs/local-vision.md                                                  │
                       └───────────────────────────────────────────────────────────────────────┘

  read by the ASSISTANT at every new session (built into one system prompt, in this order)
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │ 1. built-in operator rules (src/orchestrator/prompt/*.ts)                                 │
  │ 2. config/config.yaml → orchestrator.rules            (your standing rules)               │
  │ 3. config/notes.md            ◄── "remember …" adds a line   (copied from notes.example.md)│
  │ 4. state/registry.json        → project status + recent task history                      │
  │ 5. state/conversation.json    → handoff + last 20 exchanges                               │
  │ 6. agents/voice-assistant.md  → routing rules; LAST, so they win on when to ask           │
  └─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │ run_task
                                         ▼
  read by WORKERS (Claude Code in a project's folder, settingSources user + project + local)
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │ <account dir>/CLAUDE.md (global style)  +  <project>/CLAUDE.md (project rules)            │
  │ <account dir> = ~/.claude for personal, ~/.claude-work for work                           │
  │ For this repo: CLAUDE.md, which also governs any Claude Code session editing it           │
  └─────────────────────────────────────────────────────────────────────────────────────────┘

  written by the APP, never read by a model
    state/todo/*.md (tasks set aside by a usage limit)   state/feed.jsonl, state/chats/ (UI chats)
```

### Markdown files

| File                                       | What it contains                                                                                                                                                         | Read by                                                                                                                     | When to reference it                                                                                  | Related files                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYSTEM_KNOWLEDGE.md` (this file)          | How the assistant works inside: architecture, sessions, memory, routing, config, decision rules, validation, logs, tokens                                                | People                                                                                                                      | To understand or explain _why_ the assistant behaves as it does, or to find where something is stored | Summarizes and points at all the others and at `src/`                                                                                                                   |
| `README.md`                                | What the app does from the user's side: features, setup, running, example session, folder layout, limits                                                                 | People                                                                                                                      | Installing, first run, "what can I say to it?"                                                        | Overview of everything; this file goes deeper                                                                                                                           |
| `CLAUDE.md`                                | Rules for **coding on this repo**: commands (typecheck, lint, test), size limits, zod at boundaries, test rules, refactor rules                                          | Claude Code sessions and workers editing this repo                                                                          | Before changing the app's code                                                                        | Adds to the global `~/.claude/CLAUDE.md`; **not** read by the assistant (`settingSources: []`)                                                                          |
| `~/.claude/CLAUDE.md` (outside the repo)   | Your global code style for every project: naming, functions, readability, types, cleanup                                                                                 | Every Claude Code session and worker on the personal account (work-account workers read `~/.claude-work/CLAUDE.md` instead) | Writing or reviewing code in any project                                                              | `CLAUDE.md` adds this repo's specifics on top                                                                                                                           |
| `agents/voice-assistant.md`                | The specialized agent: name, description, and the four required rule sections (project and session routing, requirement clarity, new session or continuation, task type) | The assistant, last in its prompt                                                                                           | Changing **how it routes, when it asks, how it labels tasks**                                         | Checked at startup by `src/config/assistant-agent.ts`; explained in [section 6](#6-decision-edges-of-the-specialized-agent); outranks the standing rules on when to ask |
| `config/notes.md` (local, gitignored)      | **Your** facts for the assistant: aliases ("the store" = webshop), project facts, preferences, under `## Aliases`, `## Project notes`, `## Other`                        | The assistant, at every new session                                                                                         | Teaching it a name or fact; checking what it "remembers"                                              | Written by the `remember` tool; starts as a copy of `notes.example.md`; explained in [section 3](#3-notes-and-memory)                                                   |
| `config/notes.example.md`                  | A template for `notes.md` with sample entries                                                                                                                            | People (copied once at setup)                                                                                               | Setting up a new machine                                                                              | Copy to `config/notes.md`; never read by the app                                                                                                                        |
| `docs/gestures-plan.md`                    | Build plan for camera gestures, `look_at_camera` and screen history, in milestones with status                                                                           | People                                                                                                                      | Working on `src/sensors/`, `src/camera/` or `sensors/gestures/`                                       | Linked from `sensors/gestures/README.md`                                                                                                                                |
| `docs/local-vision.md`                     | Setting up a local vision model (llama.cpp) for `camera.describer: local`                                                                                                | People                                                                                                                      | Turning on local camera descriptions                                                                  | `config/config.yaml` → `camera`; `src/camera/`                                                                                                                          |
| `sensors/gestures/README.md`               | The Python gesture sensor: setup, gestures, use in the orchestrator                                                                                                      | People                                                                                                                      | Installing or tuning gestures                                                                         | `docs/gestures-plan.md`; `config/gestures.yaml`; `config.yaml` → `sensors.gestures`                                                                                     |
| `state/todo/*.md` (local)                  | One task each that an account's usage limit put aside: project, session, account, reset time, full task                                                                  | The app (`list_todo`, `run_todo`); people may edit                                                                          | "What's in my todo?", or retrying after a limit resets                                                | Written by `src/limits/`; **not** your personal to-do list (`state/todo-items.json`)                                                                                    |
| `sensors/gestures/.pytest_cache/README.md` | Generated by pytest                                                                                                                                                      | Nobody                                                                                                                      | Never                                                                                                 | Safe to ignore                                                                                                                                                          |

### Non-Markdown files that hold knowledge

| File                                        | What it contains                                                                      | Read by                                         | When to reference it                                                 | Related files                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `config/config.yaml` → `orchestrator.rules` | Your standing rules ("always run tests", "answer in English")                         | The assistant, before your notes                | A habit it should always follow                                      | Can't override the destructive checks; `agents/voice-assistant.md` wins on when to ask |
| `config/destructive.yaml`                   | Commands that need a spoken "confirm <verb>"                                          | The app's code (not a model); hot-reloads       | Deciding what must never run without your words                      | Checked in `src/safety/`; can be edited by voice ("confirm edit")                      |
| `state/registry.json`                       | Projects, sessions, queues, statuses, costs, context sizes, last 10 tasks per session | The app; summarized into the assistant's prompt | "What did webshop do last time?", resuming a worker by hand          | `project_history` reads it; [section 2](#2-session-management)                         |
| `state/conversation.json`                   | The assistant's handoff and last 20 exchanges                                         | The assistant, at every new session             | Checking what it carried over after a reset or restart               | Written on each exchange and on reset; [section 3](#3-notes-and-memory)                |
| `state/assistant-agent.jsonl`               | Which agent the app started with, and which handled each turn                         | People                                          | Checking that the specialized agent is really in use                 | Validates `agents/voice-assistant.md`; [section 7](#7-validation-and-logging)          |
| `state/feed.jsonl`, `state/chats/`          | The chats shown in the web UI                                                         | The web UI only                                 | Never needed for the model; emptied by **Clear** / **Clear session** | Not memory: no model reads them                                                        |

### Which file do I open?

| I want to…                                      | Open                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Understand how the assistant works              | `SYSTEM_KNOWLEDGE.md`                                                         |
| Install or run the app                          | `README.md`                                                                   |
| Change the app's code                           | `CLAUDE.md` (and `~/.claude/CLAUDE.md`)                                       |
| Change how the assistant routes or when it asks | `agents/voice-assistant.md`                                                   |
| Teach it a name, alias or project fact          | Say "remember …", or edit `config/notes.md`                                   |
| Give it a habit to always follow                | `orchestrator.rules` in `config/config.yaml`                                  |
| Stop a command from running without my say-so   | `config/destructive.yaml`                                                     |
| See what a project did before                   | Ask "what did X do last time?" (`state/registry.json`)                        |
| See tasks blocked by a usage limit              | `state/todo/`                                                                 |
| Work on gestures or the camera                  | `docs/gestures-plan.md`, `sensors/gestures/README.md`, `docs/local-vision.md` |

---

## 1. Architecture overview

There are two kinds of Claude in this system, and keeping them apart is the key to everything else:

|                    | The **assistant** (orchestrator, operator)                                                                     | The **workers**                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| What it is         | One long-lived Agent SDK session, running as the specialized agent `voice-assistant`                           | One headless Claude Code conversation per project **session**     |
| Does it code?      | **No.** It has no Bash, Edit or Read tools. It can only call its own tools (`mcp__ctl__*`) and Google Calendar | Yes: full Claude Code, in the project's folder                    |
| Account            | `orchestrator.profile` (normally `personal`)                                                                   | The project's `profile` (`personal` or `work`)                    |
| Model              | `orchestrator.model` (e.g. `haiku`, `sonnet`)                                                                  | The project's `model`, or Claude Code's default                   |
| Reads `CLAUDE.md`? | No (`settingSources: []`)                                                                                      | Yes: user, project and local settings, like your VS Code sessions |
| Code               | `src/orchestrator/`                                                                                            | `src/workers/`                                                    |

### The path of one spoken request

```
hold hotkey ─► sox records ─► whisper.cpp transcribes ─► input queue
                                                            │
                         "[USER] fix the footer on webshop" ▼
                    ┌─────────────────────────────────────────────┐
                    │ Assistant (Agent SDK, agent "voice-assistant")│
                    │  system prompt = operator rules + your rules  │
                    │    + your notes + live project status         │
                    │    + recent tasks + last exchanges/handoff    │
                    │    + the agent's routing rules                │
                    └───────────────┬─────────────────────────────┘
          short spoken reply ◄──────┤ tool calls (run_task, new_session, …)
          (say / web UI)            ▼
                    TaskIntake ─► SessionRuns ─► TaskRunner ─► Claude Code worker
                                                              (project folder, project account,
                                                               resumed claudeSessionId)
                                                                   │
                     "[EVENT] webshop session 2 finished …"  ◄─────┘
```

1. **Voice in** (`src/voice/`). Holding the hotkey records with `sox`; `whisper.cpp` turns it into text. A second
   recording made while the first is still being transcribed is merged into the same message.
2. **Input queue** (`src/orchestrator/conversation/`). Everything the assistant hears is a tagged line: `[USER]` for
   your words, `[EVENT]` for a finished or failed task, `[PERMISSION pN]` for a worker waiting for approval, `[UI]`
   for something you clicked, `[NOTICE]` for something you were already told. Notifications are given one at a time;
   the next waits until you've answered.
3. **The assistant's turn** (`src/orchestrator/model/`). The line goes into the long-lived SDK session. The reply is
   spoken as it streams, before its tool calls run, so you hear the acknowledgment immediately.
4. **Tools** (`src/orchestrator/tools/`). The assistant acts only through tools. Each tool parses its arguments with
   `zod` and turns any error into text the assistant can read aloud, instead of crashing the session
   (`tool-kit.ts`, `defineTool`).
5. **Workers** (`src/workers/`). `run_task` hands the instruction to the project's active session. A busy session
   queues it. A worker runs Claude Code with the project's folder, account and settings, resuming the session's
   previous conversation.
6. **Back to you.** When the worker finishes, an `[EVENT]` comes back to the assistant, which says one short sentence
   ("webshop session 2 finished: footer links fixed") and puts the longer text after `[SCREEN]`, which is shown in the
   web UI but never spoken.

### What "specialized agent" means here

The assistant isn't plain Claude with a system prompt. It runs as a named **agent** defined in
`agents/voice-assistant.md`:

- `src/config/assistant-agent.ts` reads and validates the file (frontmatter `name` + `description`, and four required
  rule sections).
- `src/orchestrator/prompt/agent-prompt.ts` (`AgentPrompt`) builds the SDK `AgentDefinition`: the full operator system
  prompt, then `You are the "voice-assistant" agent.`, then the agent's own rules. It uses `model: "inherit"`, so it
  runs on `orchestrator.model`.
- `src/orchestrator/model/operator-options.ts` (`OperatorOptions`) starts the SDK session with
  `agent: "voice-assistant"` and `agents: { "voice-assistant": definition }`, so the agent runs the main thread. The
  same prompt is also passed as `systemPrompt`, as a safety net should the agent not apply. There is no setting to run
  as plain Claude.
- The tool set is locked down: `tools: []` (no built-ins), `allowedTools: ["mcp__ctl__*", …calendar tools]`,
  `permissionMode: "dontAsk"`. Other claude.ai connectors stay blocked; only the Google Calendar tools are named.

**Why a separate agent file?** The routing rules (which project, which session, ask or act, what kind of task) are
the part you'll most want to tune. Keeping them in one Markdown file, outside the TypeScript, lets you change the
assistant's judgment without touching code, and the startup check makes sure a broken edit can't silently degrade it.

### Wiring

`src/main.ts` is the entry point; `src/app/` builds every part from the config and passes collaborators in.
`src/app/operator-session.ts` (`buildOperatorSession`) is the single place where the assistant's prompt, agent, tools
and logging are put together.

`npm start` runs `src/supervisor.ts`, which starts `main.ts` and starts it again whenever it exits with code `75`
(`RESTART_EXIT_CODE`), which is how "restart the orchestrator" works without doubling ports or workers.

---

## 2. Session management

The word "session" means two different things. Don't mix them up.

### 2a. Worker sessions (per project)

A **worker session** is one Claude Code conversation inside a project, like a tab in VS Code's Claude panel.

**Where they live.** `state/registry.json` (schema in `src/registry/registry-schema.ts`, version 2). Per project:
its `profile` and its `activeSession`. Per session:

| Field                                     | Meaning                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `id`, `project`, `number`                 | Identity. `number` is what you say: "webshop session 2"                                     |
| `status`                                  | `idle`, `running`, `waiting_permission`, `done`, `failed`, `stopped`                        |
| `claudeSessionId`                         | Claude Code's own session id; the next task **resumes** it, so the worker keeps its context |
| `task`, `queued[]`                        | The running task and the tasks waiting behind it                                            |
| `lastResult`, `lastError`, `lastActivity` | For "what is it doing?" and status questions                                                |
| `costUsd`, `conversationCostUsd`          | What the session has cost (see [Token management](#8-token-management))                     |
| `contextTokens`, `contextWindow`          | How full its context is                                                                     |
| `handoff`                                 | The summary it took over from an earlier session; its first task starts with it             |
| `history[]`                               | Its last 10 finished tasks                                                                  |

**How they're created.**

- A project gets its first session when it is registered (`Registry.ensure`).
- `new_session` (voice: "new session on webshop") opens a fresh one and makes it active (`Registry.createSession`).
- **+ New session** in the web UI does the same.
- A **handoff** opens a successor session carrying a summary of the old one (`src/workers/session-successor.ts`).
- Closing a project's last session leaves a fresh empty one, so a project always has an active session.

**What they do.** Every task sent to a project goes to its **active** session unless a session is named.
`TaskIntake.run` (`src/workers/task-intake.ts`) writes the task into the session's chat, then either starts it or
queues it ("webshop session 2 is busy; queued as #1."). Each task resumes the session's `claudeSessionId`, so the
worker remembers what it did before in that session.

**The session tools.**

| Tool                                      | What it does                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `list_sessions`                           | A project's open sessions, their status, which is active                              |
| `new_session`                             | Open a fresh session and make it active                                               |
| `switch_session`                          | Make another session active                                                           |
| `close_session`                           | Stop its worker, cancel its approvals, delete its queue and history from the registry |
| `run_task`                                | Start or queue a task in the **active** session                                       |
| `stop_task`                               | Stop one session's running task and clear **its** queue; other sessions keep going    |
| `list_queued_tasks`, `remove_queued_task` | See or drop one queued task, by place or words                                        |
| `summarize_changes`                       | A spoken 3–4 sentence summary, made in a read-only **fork** of the active session     |

**When to use a new session** is decided by the agent's rules ([section 6](#6-decision-edges-of-the-specialized-agent)):
in short, follow-ups continue, unrelated work gets its own session.

**What survives a restart.** Open sessions, their `claudeSessionId`s, queues, history and chats
(`state/chats/`). A task that was running when the app stopped shows as stopped; the next task resumes the same
conversation. Closing a session doesn't delete Claude Code's own transcript in the account's config folder, so you
can still `claude --resume <claudeSessionId>` by hand (but never at the same time as the worker).

**Forks.** Two jobs run in a _fork_ of a session's conversation, so the worker's own context isn't touched:
`summarize_changes` (`src/workers/change-summarizer.ts`, read-only tools, max 8 turns) and the handoff summary
(`src/workers/handoff-writer.ts`, no tools, max 2 turns). Both run on the **project's** account, so work code never
reaches the personal account in raw form; only the short text comes back.

### 2b. The assistant's own session

The assistant has exactly one model session at a time (`src/orchestrator/model/operator-session.ts`). It is
**restarted** in three cases:

| Case                    | Trigger                                                                                                                 | What carries over                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Scheduled reset**     | Session older than `orchestrator.resetMinutes` (default 60) **and** no permission request waiting (`reset-schedule.ts`) | A handoff written by the old session                                                              |
| **Reset on request**    | "restart your context" → `reset_context` with `keep: notes`; "forget everything" → `keep: nothing`                      | A handoff, or nothing                                                                             |
| **Clear** in the web UI | The Assistant chat's **Clear** button                                                                                   | A handoff; the chat messages are deleted                                                          |
| **Crash**               | The SDK stream dies                                                                                                     | Nothing new; it restarts after 1 s, doubling up to 30 s for crashes in a row (`crash-backoff.ts`) |

A reset never loses operational state: projects, sessions, queues, approvals and history live in the registry, outside
the model. The new session's system prompt is **written fresh** from the current state (see [section 3](#3-notes-and-memory)).

A full **app restart** ("restart the orchestrator", tool `restart_orchestrator`) is different: it stops running worker
tasks and exits with code 75; the supervisor starts the app again.

---

## 3. Notes and memory

The assistant has four kinds of memory. None of them is the model's context: each is a file, and each is read back into
the system prompt whenever a new assistant session starts (`src/orchestrator/prompt/system-prompt.ts`).

| Memory             | File                                         | Written by                                 | Read back as                                                                        | Limits                                                                                              |
| ------------------ | -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Your notes**     | `config/notes.md`                            | You (edit by hand) and the `remember` tool | "The user's notes (follow them like the standing rules)"                            | One line per note, ≤ 300 characters                                                                 |
| **Conversation**   | `state/conversation.json`                    | Every exchange; resets                     | "Handoff from your previous session" + "Last exchanges before this session started" | Last 20 exchanges, each side clipped to 300 characters; handoff ≤ 150 words                         |
| **Task history**   | `state/registry.json` (`sessions.*.history`) | Every finished task                        | "Recent tasks per project"                                                          | 10 per session; result clipped to its last 1500 characters; the prompt shows the last 3 per project |
| **Standing rules** | `config/config.yaml` → `orchestrator.rules`  | You                                        | "The user's standing rules"                                                         | —                                                                                                   |

### The `remember` function

Defined in `src/orchestrator/tools/assistant-tools.ts`, implemented by `AssistantNotes.remember`
(`src/orchestrator/memory/assistant-notes.ts`).

- **When it's called.** You say "remember this", or state a lasting alias, preference or project fact.
- **Arguments.** `note` (one short line) and `section`, one of `Aliases`, `Project notes`, `Other`.
- **Where it writes.** `config/notes.md` (path constant `NOTES_PATH` in `src/config/paths.ts`). The file is local and
  gitignored; start it from `config/notes.example.md`.
- **How it writes.**
  1. The note is made one line (line breaks → spaces) and clipped to 300 characters.
  2. If the exact bullet is already in the file, nothing changes ("Already in your notes.").
  3. Otherwise it is added as `- <note>` at the end of its `## <section>`. A missing section is added at the end of the
     file.
  4. The file is written to `config/notes.md.tmp` first and then renamed, so a crash can't leave it half-written.
- **When it takes effect.** The notes are read when a new assistant session starts: on app start, after a context
  reset, after a crash restart. A note saved mid-session is on disk at once but enters the prompt at the next start.
  Within the current session the assistant still knows it, because it just wrote it.

### What is **not** the assistant's memory

- `state/feed.jsonl` is the Assistant chat as **shown in the web UI**. It survives restarts and resets and is emptied
  only by **Clear**, but it is never fed back to the model.
- `state/chats/` holds each worker session's chat for the UI.
- The workers' own memory is their Claude Code conversation (resumed by `claudeSessionId`) and the project's
  `CLAUDE.md`, not anything in this app.

---

## 4. Routing logic

Routing answers three questions for every request: **which project**, **which session**, and **what to tell the
worker**. Part of it is code (deterministic), part is the agent's judgment (rules in `agents/voice-assistant.md`).

### 4a. Which project (code + judgment)

The assistant always passes the project **as spoken**; the code resolves it.
`resolveProject` in `src/config/project-names.ts` normalizes both sides (lowercase, letters and digits only, so
"Web Shop." → `webshop`) and tries, in order:

1. an exact match;
2. one name starting with the other ("web" → `webshop`);
3. one name containing the other.

If nothing matches, the tool returns `No project like "…". Known: … Use open_project to add it.` (`needProject` in
`src/orchestrator/tools/tool-kit.ts`), and the assistant reads that out or asks.

On top of the code, the agent's rules make the assistant act only when the project is **certain** (named, or the one
being discussed); confirm when the match isn't exactly what it heard ("webshop, right?"); otherwise ask, naming the
likely candidates. Your aliases in `config/notes.md` ("the store" = webshop) are how it learns names whisper keeps
producing.

**Unknown folders.** `open_project` finds a folder by spoken name under `searchRoots` (depth 3) and registers it on
an account ("work"/"company" → work, "personal"/"private" → personal). Projects added this way are saved in
`state/projects.json`, merged over `config.yaml` at start (`src/config/project-overlay.ts`).

### 4b. Which account

Each project has a `profile`; each profile is a Claude config folder (`CLAUDE_CONFIG_DIR`). `envForProfile`
(`src/config/accounts.ts`) builds the worker's environment and **removes** `ANTHROPIC_API_KEY` and
`CLAUDE_CODE_OAUTH_TOKEN`, which would otherwise silently put both accounts on one key. For the default `~/.claude`
folder it leaves `CLAUDE_CONFIG_DIR` unset, because setting it changes which macOS Keychain entry Claude Code reads.
`set_project_account` switches a project's account; each of its sessions then starts a fresh conversation, since
conversations belong to a config folder.

### 4c. Which session (judgment, then code)

The agent's rules choose between **continue** (call `run_task` → the active session, queued if busy) and **new**
(call `new_session` then `run_task`). See [6c](#6c-new-session-or-continuation) for the exact rules. When unsure, it
calls `list_sessions` first, then asks.

Code then makes the rest deterministic: `run_task` always targets the **active** session
(`TaskIntake.run` → `directory.activeSession(project)`), so "routing to session 2" means `switch_session` first, or a
new session, which becomes active automatically.

### 4d. What to tell the worker

The instruction starts with the task type prefix ([6d](#6d-task-type)), contains the request "exactly as the user
means it", plus full paths of any attached files. The assistant never does the work itself.

---

## 5. Configuration

| File                                    | What it holds                                                       | Tracked in git?                      | When it's read                                       |
| --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `agents/voice-assistant.md`             | The specialized agent: name, description, routing rules             | Yes                                  | At start; the app refuses to start without it        |
| `config/config.yaml`                    | Accounts, projects, voice, UI, permissions, budget, sensors, editor | No (copy from `config.example.yaml`) | At start only; restart after editing                 |
| `config/destructive.yaml`               | Commands that need a spoken "confirm <verb>"                        | Yes                                  | Hot-reloads; also editable by voice ("confirm edit") |
| `config/notes.md`                       | Your notes for the assistant                                        | No (copy from `notes.example.md`)    | At every new assistant session                       |
| `config/gestures.yaml`                  | Which camera gesture does what                                      | No                                   | When gestures start                                  |
| `state/projects.json`                   | Projects added by voice                                             | No                                   | At start, merged into `projects`                     |
| `<project>/.claude/settings.local.json` | "Always allow" answers (by default)                                 | Per project                          | By the workers (Claude Code)                         |

Paths are defined in one place: `src/config/paths.ts`. `state/` can be moved with the `VO_STATE_DIR` environment
variable (tests use a temp folder).

### How the assistant is configured

`config/config.yaml` → `orchestrator` (schema in `src/config/app-config.ts`, validated with `zod` at load):

| Key                   | Default               | Effect                                                                                 |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| `profile`             | required              | Which account the assistant runs on; must be logged in or the app exits                |
| `model`               | Claude Code's default | The assistant's model. `haiku` is cheaper; `sonnet` understands messy speech better    |
| `resetMinutes`        | 60                    | Age after which the assistant resets its context with a handoff, when idle             |
| `answerWindowSeconds` | 15                    | How long the next notification waits for your answer to a "task finished" message      |
| `rules`               | `[]`                  | Standing instructions, added to the prompt; they can't override the destructive checks |

Other sections that shape its behavior: `permissions.mode` (`auto` / `ask`), `voice.speak`
(`all` / `questions` / `muted`), `budget` ([section 8](#8-token-management)).

### The system prompt, in the order the model sees it

Built fresh for each new assistant session (`PromptBasics`, `ProjectSituation`, `ConversationMemory`, `AgentPrompt`):

1. `SYSTEM_PROMPT` (`src/orchestrator/prompt/system-prompt-text.ts`): how to talk (1–3 short sentences, `[SCREEN]`
   for detail), what it controls, the incoming message tags, the destructive-action rules.
2. `TODO_PROMPT`: the personal to-do list, kept apart from the usage-limit todo list.
3. Your standing rules (`orchestrator.rules`).
4. Your notes (`config/notes.md`).
5. The current date and time, the project names and account names.
6. Current status of every project, recent tasks per project, waiting permission requests.
7. The conversation recap: handoff and last exchanges.
8. `You are the "voice-assistant" agent.` and the agent file's rules, which take precedence over earlier guidance
   about when to ask.

### Changing the assistant's behavior: where to edit

| You want to change…                                        | Edit                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| How it routes, when it asks, how it labels task types      | `agents/voice-assistant.md` (restart the app)                 |
| A personal habit ("always run tests", "answer in English") | `orchestrator.rules` in `config/config.yaml`                  |
| A name, alias or project fact                              | Say "remember …", or edit `config/notes.md`                   |
| Which commands need "confirm …"                            | `config/destructive.yaml`, or say "add … to destructive"      |
| How it talks, its general duties                           | `src/orchestrator/prompt/system-prompt-text.ts` (code change) |

---

## 6. Decision edges of the specialized agent

These are the rules in `agents/voice-assistant.md`. The startup check requires each of the four sections to exist,
under its exact `## ` heading, with text under it. They come after everything else in the prompt and win over earlier
guidance about when to ask, but they **never** loosen the destructive-action rules.

### 6a. Project and session routing

| Situation                                              | Decision                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| You named the project, or it's the one being discussed | Act                                                                  |
| Project not certain                                    | Ask one short question naming the likely ones: "webshop or billing?" |
| The matched name isn't exactly what was heard          | Confirm first: "webshop, right?"                                     |
| You named a session ("session 2")                      | Use it                                                               |
| No session named, project has several                  | Apply 6c; if still open, ask                                         |

### 6b. Requirement clarity

| Request                                                                             | Decision                                                                                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Changes files or runs commands (implementation, debugging, refactoring, operations) | Say back in 1–2 sentences what will change, where, and how you'll know it's done. **Wait for "yes" / "go" / "do it"**, then `run_task` |
| Same, but you already said "just do it" / "go ahead"                                | Say what it understood and send it in the same reply                                                                                   |
| "Done" can't be described, or the request has two readings                          | Ask one short question first. Never guess                                                                                              |
| Analysis only (questions, reviews, explanations)                                    | No go-ahead needed: say in a few words what it will ask, and send it                                                                   |

### 6c. New session or continuation

| Situation                                                                          | Decision                                                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Follow-up to the session's current or last task ("also…", "fix what you just did") | **Continue**: `run_task` (queued if busy); the worker keeps its context                 |
| Unrelated work, active session **busy**                                            | **New session**: `new_session`, then `run_task`, so it runs in parallel                 |
| Unrelated work, active session **idle** but it already worked on something else    | **New session**, so each conversation stays on one topic                                |
| Unrelated work, active session idle and fresh                                      | Use the active session                                                                  |
| Can't tell follow-up from new, or whether it's busy                                | `list_sessions` first; still unclear → "Continue in session 2, or start a new session?" |

It always says which it chose: "new session on webshop", "queued after the current task".

### 6d. Task type

Every `run_task` instruction starts with a prefix, so the worker knows its limits:

| Type           | When                                                            | Prefix                                                                         |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Analysis       | Questions, reviews, explaining code, finding where something is | `Analysis only, don't change any files:`                                       |
| Implementation | New behavior, a feature, a described change                     | `Implement:`                                                                   |
| Debugging      | Something is broken or behaves wrongly                          | `Debug: reproduce it, find the cause, then fix it and say what the cause was:` |
| Refactoring    | Restructuring without changing behavior                         | `Refactor, keeping behavior identical, run the tests before and after:`        |
| Operations     | git, deploys, installs, data changes                            | `Operations:` (the confirm phrase is still needed)                             |

A mixed request is split and sent in order, usually analysis first.

"Review and commit" for a project has its own section in the agent file, which the startup check doesn't require. The
phrase is the go-ahead once the project is certain. The assistant calls `list_sessions`, asks first if a session of that
project is busy, and sends the worker to the `voice-worker:review-and-commit` skill. The skill is in
`plugins/voice-worker/`, loaded for every worker task by `src/workers/worker-options.ts`, so it reaches every project on
every account. Each commit still needs "confirm commit".

### 6e. Edges enforced in code, not by judgment

The model can't talk its way past these:

- **Destructive commands** (`config/destructive.yaml`: push, commit, reset, `rm -rf`, deploys, …) need you to
  literally say "confirm <verb>". `utteranceConfirms` (`src/safety/confirm-phrase.ts`) checks **your transcript**, and
  a negation ("don't confirm push") never counts. They can never be "always" allowed.
- **Secrets always ask**: `.env`, keys, credentials, `.npmrc`, `.ssh`, keychain, `printenv` and the like
  (`src/safety/secret-files.ts`). A `PreToolUse` hook in `src/workers/worker-options.ts` forces a prompt even if an
  allow rule would pass them.
- **Read-only commands never ask** (`src/safety/read-only-*.ts`), in either permission mode.
- **Removing a project** needs "confirm remove"; editing the destructive list needs "confirm edit".
- **Nothing is auto-approved on timeout**; unanswered requests are re-announced every `permissions.reminderMinutes`.

---

## 7. Validation and logging

### 7a. Startup sequence and its checks

`src/main.ts`, in order:

1. **Agent check** (`requireAssistantAgent`, `src/app/assistant-agent-check.ts`). Strict: nothing else starts first.
   `loadAssistantAgent` (`src/config/assistant-agent.ts`) refuses the file when:
   - `agents/voice-assistant.md` is missing;
   - it doesn't start with a `---` frontmatter block;
   - the frontmatter isn't valid YAML;
   - `name` isn't lowercase letters, digits and dashes starting with a letter, or `description` is empty;
   - any of the four required sections (`Project and session routing`, `Requirement clarity`,
     `New session or continuation`, `Task type`) is missing or empty.

   On failure it logs the problem, prints `✗ Startup stopped: …` with the reason and how to fix it, **says aloud** "The
   assistant's agent is missing or broken, so the app did not start. The terminal says why." and exits with code 1.
   On success it prints `✓ assistant agent "voice-assistant" loaded from agents/voice-assistant.md`.

2. **Config** (`loadConfig`). `config/config.yaml` is parsed and validated with `zod`; the `claude` binary is found
   via a login shell; every project's profile and `orchestrator.profile` must exist in `profiles`, or it throws.
3. **Login check** (`checkLogins`, `src/app/login-check.ts`), unless `--skip-auth-check`. Prints `✓`/`✗` per account
   with its folder and email. A logged-out **orchestrator** account exits the app; a logged-out worker account only
   warns, and its projects fail until you log in.
4. Voice, UI server (prints `UI: http://127.0.0.1:4777/?token=…`), editor, then the assistant session.

### 7b. Per-turn agent check

`AgentTurnLog` (`src/orchestrator/model/agent-turn-log.ts`) watches every assistant turn. The SDK's start-of-turn
`system/init` message lists the agents it loaded; at the turn's `result` it logs which agent handled it:

- `voice-assistant` loaded → `handledBy: "specialized"`, terminal line
  `[agent] <time> turn handled by voice-assistant (specialized)`.
- not loaded → `handledBy: "fallback"`, agent `claude`, and an **error** line
  `[agent] <time> turn handled by claude (FALLBACK: voice-assistant was not loaded)`. This should never happen; if it
  does, the turn ran on the plain system prompt without the agent's rules being guaranteed.

### 7c. Where logs and records are stored

| What                                            | Where                                                                                          | Format                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent startup results and per-turn handler      | `state/assistant-agent.jsonl`                                                                  | One JSON object per line: `{"at","event":"startup","agent","source","ok":true}`, `{"at","event":"startup","source","ok":false,"error"}`, `{"at","event":"turn","agent","handledBy"}` |
| Everything else the app reports                 | The terminal (stdout/stderr), with prefixes like `[orchestrator]`, `[agent]`, `[ui]`           | Plain text; not saved to a file                                                                                                                                                      |
| Assistant chat as shown in the UI               | `state/feed.jsonl`                                                                             | JSON lines                                                                                                                                                                           |
| Each worker session's chat                      | `state/chats/`                                                                                 | One file per session                                                                                                                                                                 |
| Sessions, queues, statuses, costs, task history | `state/registry.json`                                                                          | JSON (schema version 2)                                                                                                                                                              |
| Daily spend                                     | `state/spend.json`                                                                             | JSON                                                                                                                                                                                 |
| Worker transcripts                              | Claude Code's own folder for the account (`~/.claude/projects/…`, `~/.claude-work/projects/…`) | Claude Code's JSONL                                                                                                                                                                  |

Quick checks:

```
tail -n 20 state/assistant-agent.jsonl
```

```
grep '"handledBy":"fallback"' state/assistant-agent.jsonl
```

### 7d. Validation at the boundaries

Everything from outside the process is checked with a `zod` schema: `config.yaml`, the agent frontmatter,
`state/registry.json`, `state/conversation.json`, `state/projects.json`, HTTP request bodies, and SDK messages read for
token counts (`context-meter.ts`). Every tool's arguments are parsed with `zod` before it runs.

---

## 8. Token management

### 8a. Why context size matters

Every turn of a Claude conversation re-reads the **whole** conversation so far. A worker session that has done ten
tasks pays for all ten on every new call, even with prompt caching. Bigger context means each turn costs more, gets
slower, and eventually hits the model's context window, where Claude Code has to compact and loses detail. So a long
session gets more expensive and less sharp at the same time.

### 8b. Why big or unrelated tasks go to new sessions

- **Cost and focus.** A new session starts with an empty context, so a new topic doesn't pay for the history of an
  unrelated one, and the worker isn't distracted by it. This is the "each conversation stays on one topic" rule in
  [6c](#6c-new-session-or-continuation).
- **Parallelism.** A busy session would queue the new task; a new session runs it at once, next to the other.
- **Follow-ups are the exception.** "Also…" or "fix what you just did" continue in the same session on purpose: the
  context the worker already has is exactly what the follow-up needs, and rebuilding it would cost more.

### 8c. How the app measures it

`ContextMeter` (`src/budget/context-meter.ts`) reads the worker's SDK messages:

- **Context used** = what the worker's latest **main-loop** call read:
  `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`. Sub-agent calls are ignored; they have their
  own context.
- **Context window** = the largest `contextWindow` the result's `modelUsage` reports; until the first result,
  200,000 tokens is assumed.
- **Percent** = used ÷ window, rounded. Both numbers are saved in the session in `state/registry.json`, so a restart
  keeps them.

Money is counted by `SpendLedger` (`src/budget/spend-ledger.ts`): only what the SDK's running total **grew by** is
new spend, added to the session's `costUsd` and to the day's total in `state/spend.json`. Fork costs (handoff summary)
are charged to the session.

### 8d. Thresholds and what happens at each

From `budget` in `config/config.yaml` (defaults in `src/config/budget-config.ts`):

| Level        | Default            | What you see and hear                                                                                                                   |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| warn         | 60% of the context | Amber badge on the session tab; one chat line "Context is N% full; every further turn costs more."                                      |
| critical     | 80%                | Red badge; one chat line suggesting a handoff; **spoken once** per crossing; **Hand off to a new session** offered in the session panel |
| Session cost | $5                 | Session marked; one chat line                                                                                                           |
| Daily cost   | $25 (all sessions) | Marked; one chat line                                                                                                                   |

Each level is reported once on the way up (`isHigherLevel`, `crossedLimit`), not on every turn.

### 8e. The handoff to a new session

`SessionHandoff` (`src/workers/session-handoff.ts`), started from the session panel at 80%:

1. Refuses if the session is running ("wait for it to finish or stop it") or has no conversation yet.
2. A **fork** of the old conversation writes a Markdown summary (≤ 300 words: goal, what's done, current state,
   uncommitted changes, test status, open problems, next steps), with no tools, on the project's account.
3. A new session opens and becomes the project's **active** one; the summary is shown in its chat and stored as its
   `handoff`.
4. Its **first task** is sent as: "This session continues earlier work. Handoff summary from the previous session: …
   Your task: …" (`withHandoff`, `src/workers/handoff-prompt.ts`).
5. The old session stays as it is until you close it.

### 8f. The assistant's own context

The same idea applies to the assistant, handled differently:

- Its session is reset every `resetMinutes` when idle, keeping a ≤ 150-word handoff
  ([2b](#2b-the-assistants-own-session)).
- What it needs to know about the work (status, history, approvals) is **not** kept in its context but re-read into
  a fresh system prompt from the registry, so a reset costs nothing operationally.
- Detailed work never enters it: `summarize_changes` and handoffs run in forks on the project's account; only a few
  sentences come back. Recent history in the prompt is clipped (last 3 tasks per project, 120/240 characters).
- `orchestrator.model: haiku` keeps routing cheap; `sonnet` is better with messy speech.

---

## 9. Where everything lives (cheat sheet)

| Path                                                        | Purpose                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `agents/voice-assistant.md`                                 | The specialized agent's rules                                            |
| `config/config.yaml`                                        | Main config                                                              |
| `config/notes.md`                                           | Your notes; `remember` writes here                                       |
| `config/destructive.yaml`                                   | Confirm-phrase rules                                                     |
| `plugins/voice-worker/`                                     | Skills every project's worker gets (review and commit)                   |
| `state/registry.json`                                       | Projects, sessions, queues, statuses, costs, context sizes, task history |
| `state/conversation.json`                                   | Assistant's last 20 exchanges and handoff                                |
| `state/assistant-agent.jsonl`                               | Agent startup and per-turn log                                           |
| `state/feed.jsonl`                                          | Assistant chat for the UI                                                |
| `state/chats/`                                              | Worker session chats for the UI                                          |
| `state/spend.json`                                          | Daily spend                                                              |
| `state/projects.json`                                       | Projects added by voice                                                  |
| `state/todo/`                                               | Tasks set aside by a usage limit, one Markdown file each                 |
| `state/todo-items.json`                                     | Your personal to-do list                                                 |
| `state/screenshots/`, `state/attachments/`, `state/camera/` | Screen captures, dropped files, camera frames                            |
| `state/ui-token`                                            | The web UI's access token                                                |
| `state/bin/`                                                | Compiled Swift helpers (hotkey)                                          |
| `src/orchestrator/prompt/`                                  | The assistant's system prompt                                            |
| `src/orchestrator/tools/tool-catalog.ts`                    | Every tool the assistant has, in order                                   |
| `src/workers/`                                              | Starting, queueing, stopping workers; summaries; handoffs                |
| `src/budget/`                                               | Context and cost tracking                                                |

---

## 10. Known gaps and inconsistencies

Found while writing this; worth deciding on:

- **README vs. code on the assistant's reset.** The README says "Hourly context reset" and a "≤120-word handoff". The
  code resets after `resetMinutes` (default 60, `config.example.yaml` shows 20) and asks for at most **150** words
  (`src/orchestrator/lifecycle/context-reset.ts`).
- **Go-ahead rule vs. your standing rules.** The agent file says to wait for "yes" / "go" before sending any task that
  changes files. Your `orchestrator.rules` ask for a short acknowledgment and then tool calls. The agent file states
  that its rules win on when to ask, so implementation requests wait for your go-ahead unless you say "just do it".
- **Terminal logs aren't saved.** Only the agent log goes to a file. If you need the rest after the fact, run
  `npm start 2>&1 | tee -a state/app.log`.
- **Notes reach the prompt only at the next session start.** A note you add by hand while the app runs is picked up
  after the next reset or restart.
