# Setting up Slack and Telegram catch-up

About 5 minutes per source. Everything secret is typed into a hidden terminal prompt and goes straight to the macOS Keychain. Nothing is pasted into the web UI, written to a file, or put on a command line.

The web UI's **⚙ › Messengers** shows the same steps in short, with the commands and config to copy. A new messenger gets its steps there by adding a guide to `src/ui/messenger-guides.ts`.

## Slack (once per workspace)

```bash
npm run slack-login -- acme
```

`acme` is your name for the workspace; you'll use the same name in config.

1. Your browser opens Slack's "Create an app" page with the app already filled in: an internal app, user read scopes only (DMs, group DMs and the channels you are in), nothing that can post. Pick the workspace and click **Next › Create**.
2. Click **Install to Workspace › Allow**. If your workspace needs an admin's approval for apps, request it here.
3. Under **OAuth & Permissions**, copy the **User OAuth Token** (`xoxp-…`) and paste it at the prompt.

The command checks the token with Slack, says which workspace and user it belongs to, and warns about any missing scope before it saves the token.

Then add the workspace to `config/config.yaml` and restart the app:

```yaml
messages:
  slack:
    - workspace: acme
      profile: work # the Claude account that summarizes it
      channels: [] # optional: channels to read besides DMs and mentions, e.g. [general]
      notify: [] # optional: DMs and channels to announce as messages arrive, e.g. [Bob, general]
```

A token from before channels were always asked for can only list your DMs and group DMs. Run `npm run slack-login -- acme` again, use **Reinstall to Workspace** and paste the new token.

### Replying from the app (optional)

To have replies drafted and sent from the app (each one only after you approve it), add `send: true` to the workspace in `config/config.yaml`, then run `npm run slack-login -- acme` again:

1. The link it opens describes the replying app: the read scopes plus `chat:write` (posts as you), with **Socket Mode** on and the user events `message.im` and `message.mpim` (plus `message.channels` and `message.groups` when channels are named), so new messages are pushed to the app as they arrive. You can also make these changes by hand in your existing app; then use **Reinstall to Workspace**.
2. Paste the **User OAuth Token** (`xoxp-…`) as before.
3. Under **Basic Information › App-Level Tokens**, click **Generate Token and Scopes**, add `connections:write`, generate it, and paste the `xapp-…` token at the second prompt. It only opens the connection that pushes new messages; it is checked with Slack and saved in the Keychain as `voice-orchestrator.slack-events`.

The login says at the start whether it will ask for the app-level token. If your user token is already saved and you only need the app-level one, run `npm run slack-events-login -- acme`.

## Telegram (once)

```bash
npm run telegram-login
```

1. The first time, it asks for your app's `api_id` and `api_hash`. To get them, sign in at <https://my.telegram.org>, open **API development tools** and create an app (any name and platform).
2. It shows a QR code. On your phone, open Telegram › Settings › Devices › **Link Desktop Device** and scan it. The code changes every 30 seconds, so scan the newest one. No phone number or SMS code is needed. Telegram often doesn't deliver login codes to apps like this one, which is why it uses a QR code.
3. If you have two-step verification, it asks for that password.

Then add Telegram to `config/config.yaml` and restart the app:

```yaml
messages:
  telegram:
    profile: personal
    chats: all # or a list of chat names, e.g. [Family, Bob]
    exclude: [] # chats to always skip
    notify: [] # optional: chats to announce as messages arrive, e.g. [Family, Bob]
```

With `chats: all`, every new Telegram message is sent to the summarizer on that Claude account. That includes groups, channels and messages other people sent you. Use `exclude` to keep chats out.

## Check it

Say "catch me up on Slack and Telegram". Say it again straight away and it should say nothing is new.

## Browse every chat, write, and make tasks from messages

Open **Messages › All chats**. It lists every Slack DM, group DM and channel you are in, and every Telegram chat, group and channel (except the ones under `exclude` and Telegram's own service account), read straight from the messengers. Pick a chat to see its latest 50 messages.

- **Files:** photos, videos, voice notes and files show as chips under their message. Clicking one downloads it into `state/attachments` (kept a week) and shows it in the page: pictures and videos play there, and the saved path is shown. Files over 200 MB aren't downloaded.
- **Make task** on a message opens the to-do dialog filled in with who wrote it, where, when and the text. The message's files are downloaded and listed under "Attached files:" so the worker can open them. Edit it, pick a project and save; **Run on…** in the to-do list hands it to a worker as usual.
- **Several messages, one task:** press and hold a message (or tick the box that shows on hover) to start selecting, then click more. The bar under the chat says how many are selected; **Make one task** puts them all, with all their files, into one to-do item.
- **Writing:** type in the box under the chat and press **Send** or ⌘↵. Only what you send this way is written; nothing is sent for you. Telegram works as soon as you're logged in. Slack needs `send: true` on the workspace (and a login after adding it), because posting as you needs `chat:write`.

Nothing is marked read. Messages aren't stored; downloaded files stay a week in `state/attachments`. Characters you can't see are taken out of the shown text, and secrets are hidden. The Slack login also asks for `files:read` now, so log in again to open Slack files.

## Hear new messages as they arrive (optional)

Put the chats you want to hear about under `notify`, as shown above, and restart the app. When someone writes there you hear a short notice such as "Telegram: a new message from Bob", with no message text. `notify` picks only from chats the catch-up already reads: a Slack channel has to be under `channels` too, and an excluded Telegram chat is never announced. At startup the terminal says how many chats it watches and warns about any name it couldn't find. Telegram notices come within seconds; Slack is checked once a minute.

## Replace or remove access

| To                      | Do                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Replace a Slack token   | `npm run slack-login -- acme` again; it overwrites the saved one                                                                         |
| Revoke Slack            | Delete the app at <https://api.slack.com/apps>, then `security delete-generic-password -s voice-orchestrator.slack -a acme`              |
| Log in to Telegram anew | `npm run telegram-login` again (the app asks for this when Telegram signs it out)                                                        |
| Revoke Telegram         | Telegram › Settings › Devices › terminate the session, then `security delete-generic-password -s voice-orchestrator.telegram -a session` |
