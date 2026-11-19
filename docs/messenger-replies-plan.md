# Slack and Telegram replies: build plan

Goal: turn the read-only catch-up into a reply assistant. Every incoming DM gets a draft reply. When it's about a
codebase, a worker checks the code first. Drafts are prefilled where you can see them, and you send them by voice
or with a button. The app never sends anything on its own.

Status legend: [ ] todo, [~] in progress, [x] done.

## Hard rules (not negotiable, enforced in code)

1. **Nothing is sent without your approval, ever.** The orchestrator model gets no send tool. Only code that
   reacts to your click on **Send** or to the spoken phrase "confirm send" can send. An approval is tied to the
   hash of the exact draft text: editing the draft after approving cancels the approval.
2. **Incoming messages are untrusted data.** They are cleaned by `sanitize.ts`, then triaged by a no-tool Haiku
   session whose output is zod-validated JSON. The research worker gets the triage's restated question, with the
   original quoted as data, and runs read-only. In research mode, a request for a secret is denied, not asked.
3. **Every draft goes through secret hiding** (`hidden-secrets.ts`) before it is shown, prefilled or sent, and
   again just before sending, since your edits could add a secret.
4. **Accounts stay separate.** Each Slack workspace and Telegram use their configured `profile`. When a draft
   needs a project's code, the research and the draft run on that project's account, so its code never reaches
   another account.
5. **No message text in `state/`** (Slack API terms). The original message is fetched again when a card is
   shown. Only your draft text, ids and timestamps are stored.

## Flow

```
new DM (or a chat whose rule says draft)
  → debounce 20 s (a burst becomes one item)
  → sanitize → triage (Haiku, no tools, JSON: needsReply, kind, project?, urgency, question)
      ├─ needsReply = false  → inbox item only, no draft
      ├─ chat / logistics    → quick draft (Haiku, style card + your recent lines in that chat)
      └─ asks you about code → read-only research task on that project → draft with sources
  → secret hiding → card: Messages tab + small muted pop-up (or batched while in focus)
  → Telegram: also saveDraft, so it sits in Telegram's own message box
  → you: Send / Edit / 🎙 Dictate / Variants / Make task / Later / Dismiss
```

## UI

**Small pop-up (default: silent, text only).** A compact chip in the bottom-right corner that doesn't take focus
and hides after a few seconds into a count badge:

```
┌ 💬 Bob · Slack acme ─ draft ready ─ ✕ ┐
│ "is refund idempotent on retries?"    │
└───────────────────────────────────────┘
```

Click it to open the full card (notice-panel size). VIP chats and urgent keywords can use a louder alert, set by
the chat rules.

**Full card.** The message and thread context, the draft, "checked billing · 3 files" (opens to show them),
variants (Short / Full / Ask back), then the buttons **Send**, **Edit**, **🎙 Dictate**, **Make task**, **Later**,
**Open ↗**.

**Messages tab** (next to Assistant), with three views:

- **Inbox:** open items by status: drafting… / draft ready / sent / snoozed / no reply needed. This is also the
  "who am I owing a reply" list.
- **Rules:** a table of chat rules, editable inline (see below).
- **Styles:** your style card per person and chat, editable, with **Refresh**.

**Bottom strip / top bar control:** `💬 3` badge, a 🔕 alerts-mute toggle (muted by default), and a 🎯 Focus
toggle. The same controls are under ⚙ › Messengers.

**Voice:** "read Bob's draft", "make it shorter and mention X", "confirm send" (sends the card in focus; the
panel highlights which one), "later", "make it a task", "mute Bob", "focus on" / "focus off", "what's waiting?".

## Chat rules

Stored in `state/messages/chat-rules.json` (zod-validated, written by the UI and by voice, read live). Defaults
come from config. Each rule is matched by the chat's ID, like `notify`, so renaming a chat doesn't break it.

| Field      | Values                                                         | Default for DMs   |
| ---------- | -------------------------------------------------------------- | ----------------- |
| `mode`     | `draft` · `notify` · `silent` · `ignore`                       | `draft`           |
| `alert`    | `popup` · `speak` · `none`                                     | `popup` (muted)   |
| `priority` | `vip` · `normal` · `low`                                       | `normal`          |
| `project`  | a project name, for code questions                             | guessed by triage |
| `research` | `allowed` · `never`                                            | `allowed`         |
| `note`     | free text for the drafter ("formal, English, he's the client") | none              |

VIP chats skip focus batching. Groups and channels default to `notify` and only get drafts when a rule says
`draft`.

## Your style, per person and chat

1. **Style card.** A short description per chat and person, built from _your own_ past messages there
   (Slack `search.messages from:me in:<chat>`, Telegram history filtered to your id). It covers language, tone,
   formality, length, emoji, greetings and sign-offs, how you address them, and typical phrasing. It's built on
   that source's account and stored as a description only, never as quotes. A global "my voice" card is the
   fallback.
2. **Live examples.** When drafting, your last ~10 messages in that chat are fetched (not stored) and given to the
   drafter as examples.
3. **Learning from edits.** When you edit a draft and send it, the difference ("removed the greeting, shortened
   it, switched to Russian") is folded into that chat's card. This is the strongest signal over time.
4. **Your override.** The rule's `note` and the editable card in the Styles view always win.

Cards are refreshed weekly, or when you say "refresh my style with Bob".

## Focus batching

With 🎯 Focus on (or when you're mid-task with a worker), chips don't appear. Items queue up and are delivered as
one "4 replies waiting" chip at a natural break: a task ends, every 30 minutes, or when you ask "what's waiting?".
VIP and urgent items (rule `priority: vip`, or keywords like "prod down") still show.

## Message → task → follow-up

**Make task** on a card turns the message into a task for the mapped project's session. You see the proposed task
text and can edit it, and the usual go-ahead rules apply. The card remembers the task. When the task ends, a
follow-up draft appears in the same thread ("Fixed in a1b2c3, deploying now") and goes through the same approval.

## Slack: write access

- The manifest gets `chat:write` (user scope, posts as you) when the workspace has `send: true` in config. The
  app's name drops "(read-only)".
- `slack-login` checks the scope, and the token check reports it if missing.
- For an existing app: api.slack.com/apps → the app → **OAuth & Permissions** → **User Token Scopes** → add
  `chat:write` → **Reinstall to Workspace** → run `npm run slack-login -- <workspace>` again and paste the token.
  Some workspaces need an admin to approve the reinstall.
- Replies go in the thread when the message was in a thread (`thread_ts`).
- Slack has no public API for prefilling Slack's own message box, so the prefill lives in our card. **Open ↗**
  copies the draft and opens the conversation, as a fallback.

### Real-time delivery (Socket Mode, user events)

Slack pushes your DMs, group DMs and named channels to the app as they arrive, through an outgoing WebSocket. You
don't need a public URL or a bot user. It is set up in the same app, and the same reinstall, as `chat:write`.

Manifest generated by `slack-login` when `send: true`:

```json
{
  "display_information": { "name": "Voice Orchestrator" },
  "oauth_config": {
    "scopes": {
      "user": [
        "im:read",
        "im:history",
        "mpim:read",
        "mpim:history",
        "users:read",
        "search:read",
        "chat:write",
        "channels:read",
        "channels:history",
        "groups:read",
        "groups:history"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "user_events": ["message.im", "message.mpim", "message.channels", "message.groups"]
    },
    "org_deploy_enabled": false,
    "token_rotation_enabled": false
  }
}
```

Only the channel scopes and events are left out when no channels are named.

Two tokens per workspace, both stored in the Keychain:

- **User token** (`xoxp-`, from OAuth & Permissions): reads and sends as you.
- **App-level token** (`xapp-`, Basic Information → App-Level Tokens → Generate, scope `connections:write`):
  only opens the event socket.

At runtime, `apps.connections.open` (with the `xapp-` token) returns a `wss://` URL. Each event envelope is acked
by its `envelope_id` within 3 s, then handled. Rules for handling events:

- Skip your own messages, edits, deletions and bot echoes (subtypes).
- Reconnect on `disconnect` messages and on a dropped socket.
- After a reconnect, catch up from the cursor with `conversations.history`, so nothing is missed while it was down.
- Polling stays as the fallback for a workspace without an `xapp-` token, so existing setups keep working.

## Telegram: write access

- The existing gramjs user session can already send; no new login is needed.
- Prefill: `messages.saveDraft` puts the draft in Telegram's message box on all your devices. It's cleared once
  you send from the app or dismiss.
- Send: `sendMessage` with `replyTo` the message. DMs are pushed through the existing watch connection.
- Never: the service account 777000, secret chats, excluded chats.

## Phases

### P1: inbox and drafts for every DM

- [x] Config: `send` per source (opt-in)
- [x] Slack `chat:write` + Socket Mode user events in manifest, login asks for and checks the `xapp-` token, docs
- [x] `chat-rules.json` store with defaults (`src/messages/replies/chat-rules.ts`)
- [x] DM detection: Slack Socket Mode user events (DMs, group DMs, named channels), catch-up from history
      after a drop longer than a minute; Telegram push for private chats and groups (never bots or channels);
      bursts grouped per chat and thread for 20 s; only chats whose rule says `draft` go on
- [ ] Slack polling fallback for a workspace without an `xapp-` token (it now logs how to add one instead)
- [x] Triage (Haiku, JSON checked with zod), draft (Sonnet), secret hiding, draft store (no message text):
      each a fresh tool-free session on the source's account; code questions get a holding reply until P2
- [x] Send path: only the exact approved text is sent, once (a second send meanwhile is refused); text that looks
      like a secret is refused, not changed; Slack `chat.postMessage` as you (in the thread); Telegram reply and
      `saveDraft` prefill, cleared on send or dismiss; "confirm send" matched in code and sends only the draft the
      page marked, for 2 minutes; routes `/api/replies/:id/{edit,send,dismiss,arm}` for the Messages tab
- [x] Messages view (top bar's **Messages N**, in place of the code and chat): a card per waiting draft with the
      conversation it answers (read on opening, cleaned, never stored), Edit/Save, Dismiss, 🎙 (finishing only leaves
      the words, never sends) and Send; the box being worked on is marked for "confirm send"; back/forward knows it
- [x] Small silent pop-up per new draft (Later / Open, closes after 15 s; none for a chat with `alert: none`);
      Open brings the web UI to the draft
- [ ] 🔕 mute toggle and 🎯 Focus batching (P4)

### P2: code research and tasks

- [ ] Read-only research task on the project's account; sources on the card
- [ ] Make task, link back to the card, follow-up draft when the task ends

### P3: style

- [ ] Style cards (build, store, Styles view, refresh), live examples, learning from edits

### P4: rules and focus

- [ ] Rules view (inline edit) and rule changes by voice
- [ ] 🎯 Focus batching, VIP and urgent passthrough, "what's waiting?"

Later, not now: Telegram bot as a phone companion.

## Decided

- Slack group DMs (`mpim`) get automatic drafts, like 1:1 DMs.
- Slack uses real-time delivery: Socket Mode with user events, set up in P1. Polling is the fallback.
- A code check runs only when the message actually asks you something about code ("does X handle Y?", "why does
  Z fail?"). Triage marks this as `kind: code-question`. A mention of a project, FYI messages and chit-chat get a
  normal draft without research.
