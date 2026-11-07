# Setting up Slack and Telegram catch-up

About 5 minutes per source. Everything secret is typed into a hidden terminal prompt and goes straight to the macOS Keychain. Nothing is pasted into the web UI, written to a file, or put on a command line.

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
```

If you add `channels` later, run `npm run slack-login -- acme` again. The new link then asks for the channel read scopes too. Use **Reinstall to Workspace** and paste the new token.

## Telegram (once)

```bash
npm run telegram-login
```

1. The first time, it asks for your app's `api_id` and `api_hash`. To get them, sign in at <https://my.telegram.org>, open **API development tools** and create an app (any name and platform).
2. It asks for your phone number, the code Telegram sends to your app, and your two-step verification password if you have one.

Then add Telegram to `config/config.yaml` and restart the app:

```yaml
messages:
  telegram:
    profile: personal
    chats: all # or a list of chat names, e.g. [Family, Bob]
    exclude: [] # chats to always skip
```

With `chats: all`, every new Telegram message is sent to the summarizer on that Claude account. That includes groups, channels and messages other people sent you. Use `exclude` to keep chats out.

## Check it

Say "catch me up on Slack and Telegram". Say it again straight away and it should say nothing is new.

## Replace or remove access

| To                      | Do                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Replace a Slack token   | `npm run slack-login -- acme` again; it overwrites the saved one                                                                         |
| Revoke Slack            | Delete the app at <https://api.slack.com/apps>, then `security delete-generic-password -s voice-orchestrator.slack -a acme`              |
| Log in to Telegram anew | `npm run telegram-login` again (the app asks for this when Telegram signs it out)                                                        |
| Revoke Telegram         | Telegram › Settings › Devices › terminate the session, then `security delete-generic-password -s voice-orchestrator.telegram -a session` |
