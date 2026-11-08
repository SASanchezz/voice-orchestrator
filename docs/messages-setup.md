# Setting up Slack and Telegram catch-up

About 5 minutes per source. Everything secret is typed into a hidden terminal prompt and goes straight to the macOS Keychain. Nothing is pasted into the web UI, written to a file, or put on a command line.

The web UI's **⚙ › Messengers** shows the same steps in short, with the commands and config to copy. A new messenger gets its steps there by adding a guide to `src/ui/messenger-guides.ts`.

## Slack (once per workspace)

```bash
npm run slack-login -- acme
```

`acme` is your name for the workspace; you'll use the same name in config.

1. Your browser opens Slack's "Create an app" page with the app already filled in: an internal app, user read scopes only, nothing that can post. Pick the workspace and click **Next › Create**.
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

If you add `channels` later, run `npm run slack-login -- acme` again. The new link then asks for the channel read scopes too. Use **Reinstall to Workspace** and paste the new token.

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

## Hear new messages as they arrive (optional)

Put the chats you want to hear about under `notify`, as shown above, and restart the app. When someone writes there you hear a short notice such as "Telegram: a new message from Bob", with no message text. `notify` picks only from chats the catch-up already reads: a Slack channel has to be under `channels` too, and an excluded Telegram chat is never announced. At startup the terminal says how many chats it watches and warns about any name it couldn't find. Telegram notices come within seconds; Slack is checked once a minute.

## Replace or remove access

| To                      | Do                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Replace a Slack token   | `npm run slack-login -- acme` again; it overwrites the saved one                                                                         |
| Revoke Slack            | Delete the app at <https://api.slack.com/apps>, then `security delete-generic-password -s voice-orchestrator.slack -a acme`              |
| Log in to Telegram anew | `npm run telegram-login` again (the app asks for this when Telegram signs it out)                                                        |
| Revoke Telegram         | Telegram › Settings › Devices › terminate the session, then `security delete-generic-password -s voice-orchestrator.telegram -a session` |
