# Worker queue and /btw: redesign plan

Status: built 2026-11-27 (not committed yet). Decisions taken: ■ pauses the queue instead of clearing it; queued tasks
show only in the strip and join the chat when they start; a failed task stops the queue (paused) until Resume. Not
built: the Undo toast after ×, ↑ in an empty box to edit the last queued task, and cancelling a /btw answer in flight.

## What exists today

- `SessionQueue` (`src/workers/session-queue.ts`) keeps queued instructions in `state/registry.json` as
  `string | { instruction, model }`. Entries have **no id**, so every remove has to name a place plus the text
  it expects to find there (`queue-pick.ts`), just to notice that the queue moved.
- Removing works by voice (`list_queued_tasks`, `remove_queued_task`) and through `POST /api/sessions/:id/queue/remove`,
  but **the page has no queue list any more**. `src/ui/web/queue-list.ts`, the list with an × on each task, was deleted in
  5ccfe8c (the web UI rework) and never came back. The tabs only show "· 2 queued".
- Editing a queued task isn't possible at all.
- A queued task goes into the chat as a `task` line plus "Queued as #N" the moment you send it. If you remove it
  later, the chat still shows it as if it ran.
- `takeNext` only moves on after a task that **succeeded**. After a failure the queue just sits there with nothing
  saying so. The next message you send starts at once, and the old queue waits behind _it_.
- `/btw` is a magic prefix that `SessionInbox` parses. The page has no button for it, the voice assistant can't send
  one, and the answer looks like a normal reply.

## Design

### 1. Queued tasks get ids (core of the refactor)

```ts
interface QueuedTask {
  id: string;
  instruction: string;
  model?: string;
  queuedAt: string;
}
```

- Registry schema: an entry becomes `{ id, instruction, model?, queuedAt }`. Old string or `{instruction, model}`
  entries still parse, and get an id when they're read. **This changes the format of `state/registry.json`.**
- `SessionQueue` works by id: `add`, `list`, `remove(id)`, `edit(id, instruction)`, `moveToFront(id)`, `clear`,
  `takeNext`. Each one throws `Nothing queued with that id` once the task is gone, so a click on a stale item does nothing.
- `queue-pick.ts` stays, but only voice uses it, to turn "number 2" or "the footer one" into an id. The
  check-the-text-against-the-place logic goes away from the HTTP path.
- `QueuedTasks` becomes the single place that does a queue action and writes its chat and spoken line
  (`remove`, `edit`, `moveToFront`), so voice and the page say the same thing.

### 2. A queue strip in the session view

Above the composer, only when the session has queued tasks:

```
Queued (2) ─────────────────────────────────────
 1  add tests for the login form        ↑  ✎  ×
 2  fix the footer on mobile               ✎  ×
```

- **×** removes. No confirm, but a 5-second "Removed. Undo" toast puts it back at the same place.
- **✎** turns the row into a textarea: ↩ saves, Esc cancels. A task that starts while you're editing it keeps
  your edit out of the run and warns "It already started".
- **↑** makes it run next.
- **↑ in an empty composer** opens the last queued task for editing, the way Claude Code does. This is the quick way
  to fix a typo you just sent.
- New module `src/ui/web/queue-strip.ts` (plus `queue-row.ts` if it grows), with routes
  `DELETE /api/sessions/:id/queue/:taskId`, `PATCH …/queue/:taskId {instruction}` and `POST …/queue/:taskId/next`,
  each validated with zod in `request-body.ts`.

### 3. The chat shows a task when it starts, not when it's queued

`TaskIntake.submit` stops writing the `task` line for a queued task. `SessionRuns` writes it when `takeNext`
hands the task to the runner. Until then the task lives only in the strip. The chat then only shows what really ran,
so removing or editing a task never leaves a stale line behind. The reply "busy; queued as #N" stays the same.

### 4. When a task fails, the queue pauses and says so

When a task fails or the limit hits, the queue stays as it is but is marked `paused`. The strip header reads
"Paused: the last task failed", with **Resume** and **Clear** buttons. Sending a new message while it's paused asks
nothing: the message goes to the end of the queue and the queue resumes. That gets rid of today's silent
"new message jumps ahead of the old queue". Usage-limit parking (`limit-parking.ts`) stays as it is.

### 5. /btw becomes a real mode

- Composer: **⌥↩** sends the box as a side question. A small "aside" chip shows while ⌥ is held. Typing `/btw …`
  still works, and `SessionInbox` stays the one place that parses it.
- The answer appears as its own `aside` chat kind: indented, labelled "Side answer", never counted as the task's
  reply. While it's being answered, a "thinking…" line shows, and its × cancels it through an `AbortController`.
- Side questions never queue and never touch the strip.
- Voice: a new `ask_side_question` tool ("ask session 2 by the way what file it's in"), so the assistant can use it
  without the prefix.

### 6. Voice tools

`list_queued_tasks` and `remove_queued_task` stay. Two new ones: `edit_queued_task` (place or words, plus the new
text) and `run_queued_next`. A line goes into the system prompt saying when to use which.

## Build order (each step its own commit, tests before and after)

1. **Refactor, no behavior change:** ids in `QueuedTask`, the schema migration, `SessionQueue` by id, `QueuedTasks`
   using ids. Spoken and logged lines stay identical. (Only the registry file format changes. Flag it in the commit.)
2. Bring back the page's list with × (strip with remove only), plus the undo toast.
3. Edit (✎, ↑-to-edit) and run next (↑): routes, voice tools.
4. Chat shows tasks when they start, not when they're queued.
5. Paused queue after a failure.
6. /btw mode: ⌥↩, `aside` kind, cancel, voice tool.
