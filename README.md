# Voice Orchestrator

Push-to-talk voice operator for several Claude Code workers, across two Claude accounts.

```
hold key ─► sox ─► whisper.cpp ─► Orchestrator (personal account, Agent SDK)
                                     │  tools: run_task · project_status · summarize_changes
                                     │         git · answer_permission · destructive rules
              say ◄── short reply ◄──┤
                                     ▼
              per-project workers (Agent SDK, headless Claude Code, resumed sessions)
              webshop → personal (~/.claude)      billing → work (~/.claude-work)
```

- **Web UI.** `npm start` also serves a page at `http://127.0.0.1:4777` and opens it. The full link, with its access token, is printed in the terminal. The page shows:
  - every project's status, its current activity and its task history;
  - the approvals waiting for you, as buttons (a destructive one opens a dialog naming the exact command and allows it once);
  - **Assistant**, the main chat with the orchestrator, pinned above the projects. It can't be closed; **Clear** deletes its messages and restarts its context, keeping only a short summary and key facts. Its messages are kept in `state/feed.jsonl` and survive restarts, context resets and page reloads; **Clear** is the only thing that deletes them;
  - per project, a chat for each of its sessions;
  - switches for permission mode and speech.
  You can also send a task straight to one project's worker, or stop it. Typed messages are answered on screen. With `voice.speak: questions` (the default), only permission requests, short "X session 2 done: …" / "… failed: …" notices and replies to your voice are spoken. The page listens only on 127.0.0.1, and every request needs the token, so other websites open in your browser can't drive it.
- **Sessions, like VS Code tabs.** A project can have several worker sessions, each its own Claude Code conversation. Say "new session on webshop", "list webshop sessions", "switch webshop to session 1" or "close webshop session 2". Tasks, stop and summaries go to the project's active session. Closing a session stops its worker, cancels its pending approvals and deletes its queue and history from `state/registry.json`, so it uses nothing afterwards. Closing the last one leaves a fresh empty session. In the web UI, the project panel lists its sessions: click one to make it active, use **+ New session** to open one, and **×** to close one. **Clear session** (in the right panel) stops its worker and wipes its messages, history and worker conversation, but keeps the session open. Open sessions, their chats (`state/chats/`) and their worker conversations survive a restart; a task that was running when the orchestrator closed shows as stopped, and the next task resumes the same conversation.
- **Auto mode.** With `permissions.mode: auto` in `config/config.yaml`, workers run everything without asking, except destructive commands, which still need your spoken confirm phrase. Say "ask mode" to have every request come to you for the rest of the run, or "auto mode" to switch back. In `ask` mode, every request comes to you as described below.
- **Standing rules.** `orchestrator.rules` in `config/config.yaml` is a list of instructions the orchestrator always follows, for example "Always run tests after a change". They can't override the destructive-command checks, which run in code.
- **Permissions by voice.** A worker that needs approval pauses. You hear "webshop wants to run npm install. Allow once, always, or deny?". Nothing is ever auto-approved on timeout; you get a reminder every few minutes. "Always" is saved to the project's `.claude/settings.local.json`, so your VS Code sessions benefit too.
- **Two accounts.** Each project picks a profile, and each profile is a `CLAUDE_CONFIG_DIR`. The orchestrator runs on `personal`. You can switch a project's account by voice: "run billing on personal".
- **Destructive = say the phrase.** Commands matching `config/destructive.yaml` need you to literally say "confirm push", "confirm delete" and so on. The check runs in code against your transcript, not the model's judgment. These commands can never be always-allowed. The list hot-reloads; you can also edit it by voice ("add helm uninstall to destructive", then "confirm edit").
- **Hourly context reset.** When idle, the orchestrator writes a ≤120-word handoff and restarts from it. Project state, session ids and pending approvals live outside the model in `state/registry.json`, so nothing operational is lost.
- **Pause and keep talking.** Release the key and press it again within `voice.mergeWindowSeconds` (1.5 s by default, in `config/config.yaml`) and both recordings go out as one message, in the order you said them. The web UI shows "Holding your message…" meanwhile. Typed messages and notifications are never held.
- **Restart by voice.** Say "restart the orchestrator" and it confirms aloud, then restarts the whole app, picking up code changes. `npm start` runs a small supervisor (`src/supervisor.ts`) that starts the app again once it has fully exited, so the port, hotkey helper and workers are never doubled. Running worker tasks are stopped; projects, sessions, history and notes are kept, and the open UI page reconnects by itself.
- **Reset on request.** Say "restart your context" to get a fresh orchestrator session that keeps a short handoff, or "forget everything and start fresh" for one with no handoff. Project history is kept either way.
- **Usage limits go to a todo list.** When a worker's account hits its usage or spend limit ("You've hit your org's monthly spend limit", "usage limit", "session limit resets …"), the task isn't retried or announced as a failure. It is saved, with anything queued behind it, to `state/todo/`: one Markdown file per task, with the project, session number, account, time saved, the limit's reset time if the error gave one, and the full task text. You hear one message per account per limit episode, for example "webshop hit the work account limit; resets 9pm (Europe/Warsaw); 2 tasks saved to todo"; further limit failures on that account are saved quietly. The episode ends when a task on that account succeeds, when you re-run saved tasks, or when the error names a new reset time. Ask "what's in my todo?" or "run all todo tasks" (tools `list_todo`, `run_todo`, `discard_todo`); running one takes it off the list. You can also edit or delete the files by hand.
- **Memory across restarts.** Each project's last 10 finished tasks (instruction plus the worker's closing note) are kept in `state/registry.json`. The orchestrator's last 20 exchanges and its handoff are kept in `state/conversation.json`. After `npm start`, the new session sees both, so "what did webshop do last time?" still works.
- **Work code stays on the work account.** `summarize_changes` runs inside the project's own account (a read-only fork of its session). Only the 3–4 spoken sentences reach the personal orchestrator.

## Setup (macOS)

```bash
brew install sox whisper-cpp
xcode-select --install   # Swift compiler for the hotkey helper (skip if already installed)
# the speech model (~466 MB) downloads automatically on first `npm start`
# to ~/.whisper/ggml-small.en.bin; for several languages set voice.whisperModel
# to ~/.whisper/ggml-small.bin and voice.language to auto

npm install
cp config/config.example.yaml config/config.yaml   # then set your accounts and projects
cp config/notes.example.md config/notes.md
```

`npm start` first checks both logins and prints which folder each account uses:

```
  ✓ personal   /Users/you/.claude           you@gmail.com
  ✓ work       /Users/you/.claude-work    you@company.com
```

If one shows ✗, log in to exactly that folder: `CLAUDE_CONFIG_DIR=~/.claude claude auth login`. If your personal `claude` uses a different folder, fix `profiles.personal.configDir` in `config/config.yaml`.

Projects can be listed in `config/config.yaml` or opened by voice, for example "open database admin, and acme-web on work". Folders are found under `searchRoots`, and projects opened this way are remembered in `state/projects.json`.

Then grant your terminal app (Terminal, iTerm or the VS Code terminal) these macOS permissions in **System Settings → Privacy & Security**:
- **Microphone**
- **Input Monitoring**
- **Screen & System Audio Recording**: lets the operator see your screen when you ask ("what's this error?"). The display under your cursor is captured the moment you press the talk key. Screenshots go to the personal account and are kept in `state/screenshots/` for one day. After turning it on, fully quit and reopen the terminal. macOS may ask you to re-approve it from time to time.

The hotkey is watched by a small Swift helper (`native/hotkey.swift`), compiled into `state/bin/` on first `npm start`.

## Run

```bash
npm start          # push-to-talk (hold Right Option)
npm run start:text # type instead of talk: test the flow without audio
npm test           # safety tests + end-to-end flow (two projects, two accounts, fake Claude)
```

Notifications come one question at a time. After a permission question, the next notification waits until you answer it or say something else. When a task ends you hear the project, session number and the first few words of the task, e.g. "webshop session 7 done: resend countdown on sign-up" or "… failed: …" (the longer reply is shown on screen, and the page flashes a notice); after that it waits until you speak or `orchestrator.answerWindowSeconds` (default 15) runs out. If more are queued, the orchestrator tells you ("two more after this").

Pressing the key while Claude is speaking cuts it off. Notifications wait until you release the key and your words are transcribed, so they never cut in ahead of what you said. A reply that is ready while you are talking waits too.

## Example session

```
🔊 webshop done
🎙 details
🔊 It added rate limiting to the login endpoint using a sliding window in Redis ...
🎙 okay move changes to stage and leave them. what about dbadmin?
🔊 Staged everything in webshop, nothing committed. Dbadmin is still running, currently in the test step.
🔊 Dbadmin wants approval to run git commit. That's destructive, say "confirm commit" to allow it.
🎙 confirm commit
🔊 Allowed. Dbadmin is committing.
```

## Files

| | |
|---|---|
| `config/config.yaml` | accounts, projects, voice, reset interval (local, gitignored; start from `config.example.yaml`) |
| `config/destructive.yaml` | editable destructive rules (hot-reload) |
| `config/notes.md` | your notes for the assistant (aliases, project facts); read at every start, and "remember this" adds a line (local, gitignored; start from `notes.example.md`) |
| `src/main.ts`, `src/supervisor.ts` | entry points: the app, and the supervisor that restarts it |
| `src/app/` | wiring: builds every part from config and passes collaborators in; login check |
| `src/config/` | `config.yaml` schema and loading, accounts, login status, project names and folder search |
| `src/registry/` | projects and their sessions, behind `state/registry.json`; task history and status reports |
| `src/events/` | the app's events (task done/failed, permission, usage limit) |
| `src/orchestrator/` | the voice operator: its model session (`model/`), system prompt (`prompt/`), input queue and turns (`conversation/`), context resets and restarts (`lifecycle/`), tools (`tools/`, `actions/`), memory and notes (`memory/`) |
| `src/workers/` | per-project headless Claude Code sessions: starting, queueing, stopping, outcomes, summaries |
| `src/permissions/` | permission broker (voice approval, confirm-phrase check), plain-language explanations |
| `src/safety/` | destructive rules (`config/destructive.yaml`) and the confirm phrase |
| `src/limits/` | spotting usage-limit failures, one message per limit episode, and the todo folder |
| `src/voice/` | push-to-talk, whisper.cpp, `say`; joining recordings made within `voice.mergeWindowSeconds`; text mode |
| `src/screen/` | screenshot of the display under the cursor, one-day retention |
| `src/macos/` | builds the Swift helpers in `native/` |
| `src/ui/server/` | web UI server: live state over server-sent events, actions over POST, token check |
| `src/ui/feed.ts`, `src/ui/session-chats.ts` | the assistant's timeline (`state/feed.jsonl`) and each session's chat (`state/chats/`) |
| `src/ui/public/` | the page's HTML and stylesheets |
| `src/ui/web/` | the page's TypeScript, compiled into one script (`/app.js`) in memory when the UI server starts; no separate build step |
| `src/ui/protocol.ts` | the shapes of what the server sends the page, shared by both sides |
| `src/e2e/` | end-to-end test with Claude replaced by scripted fakes; `src/testing/` holds shared test helpers |
| `state/registry.json` | session ids and statuses (survives restarts) |
| `state/conversation.json` | orchestrator's recent exchanges and handoff (survives restarts) |
| `state/todo/` | tasks put aside because their account hit a usage limit, one Markdown file each |
| `state/feed.jsonl` | the Assistant chat shown in the web UI (survives restarts; emptied only by **Clear**) |

## Limits

- Workers are sessions this tool owns. Sessions you start by hand in VS Code aren't controlled. To take over a worker session interactively: `CLAUDE_CONFIG_DIR=… claude --resume <claudeSessionId from state/registry.json>`. Don't run both at the same time.
- Switching a project's account starts a fresh conversation in each of its sessions, because conversations belong to a config dir.
- Closing a session doesn't delete Claude Code's own transcript in the account's config dir, so you can still resume it by hand.
- Whisper `small.en` takes about 0.5–1 s per utterance on Apple Silicon. `base.en` is faster but makes more mistakes; `medium` is the opposite.
