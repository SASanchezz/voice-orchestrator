import { execFile } from "node:child_process";
import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import { loadConfig } from "../../config/load-config.js";
import { keychainWriterOnThisMac } from "../../secrets/keychain-writer.js";
import { errorMessage } from "../../shared/errors.js";
import { TerminalPrompts } from "../../shared/terminal-prompts.js";
import { appFor, newAppLink, type SlackApp } from "./slack-manifest.js";
import { saveEventsToken, workspaceName } from "./slack-login-steps.js";
import { SLACK_KEYCHAIN_SERVICE } from "./slack-reader.js";
import { checkSlackToken, type TokenCheck } from "./slack-token-check.js";

/** A workspace not in config yet gets the read-only app; `send: true` there asks for the replying one. */
const NOT_CONFIGURED = { channels: [], send: false };

/**
 * npm run slack-login -- <workspace>: creates the Slack app from a prefilled manifest, checks the pasted tokens with
 * Slack, and saves them in the Keychain. Tokens are typed hidden and never printed.
 */
async function main(): Promise<void> {
  const terminal = new TerminalPrompts();
  try {
    await setUpWorkspace(terminal);
  } finally {
    terminal.close();
  }
}

async function setUpWorkspace(terminal: TerminalPrompts): Promise<void> {
  const workspace = await workspaceName(terminal);
  const configured = configuredWorkspace(workspace);
  const app = appFor(configured ?? NOT_CONFIGURED);
  console.log(modeLine(workspace, configured));
  showAppSteps(app);
  await saveUserToken(terminal, workspace, app.scopes);
  if (app.userEvents.length) {
    console.log("4. Now the app-level token, for new messages to be pushed to the app:");
    await saveEventsToken(terminal, workspace);
  }
  if (!configured) console.log(configSnippet(workspace));
}

/** The workspace's settings in config/config.yaml, if it is there yet; a config that can't be read is said. */
function configuredWorkspace(workspace: string): SlackWorkspaceSettings | undefined {
  try {
    return loadConfig().messages.slack.find((settings) => settings.workspace === workspace);
  } catch (error) {
    console.log(`config/config.yaml couldn't be read (${errorMessage(error)}), so the app is set up read-only.`);
    return undefined;
  }
}

/** Says up front whether the app-level token will be asked for, and why. */
function modeLine(workspace: string, configured: SlackWorkspaceSettings | undefined): string {
  if (!configured) return `${workspace} isn't under messages.slack in config/config.yaml, so the app is read-only.`;
  if (!configured.send) return `${workspace} has no send: true in config, so the app is read-only.`;
  return `${workspace} has send: true: after the user token, it asks for the app-level token (xapp-…).`;
}

function showAppSteps(app: SlackApp): void {
  const link = newAppLink(app);
  const scopes = app.userEvents.length ? "read and send scopes, Socket Mode on" : "read-only scopes";
  console.log(
    [
      `1. Your browser opens Slack's "Create an app" page with the app already described (${scopes}).`,
      "   Pick the workspace, then Next › Create. If the browser didn't open, use this link:",
      `   ${link}`,
      "2. Click Install to Workspace › Allow.",
      "3. Under OAuth & Permissions, copy the User OAuth Token.",
    ].join("\n"),
  );
  execFile("open", [link], () => {}); // a missing browser only means the link is used by hand
}

async function saveUserToken(terminal: TerminalPrompts, workspace: string, scopes: string[]): Promise<void> {
  const token = await terminal.askHidden("Paste the User OAuth Token (xoxp-…; it isn't shown): ");
  reportCheck(await checkSlackToken(token, scopes, fetch));
  await keychainWriterOnThisMac().save(SLACK_KEYCHAIN_SERVICE, workspace, token);
  console.log(`Saved in the Keychain as ${SLACK_KEYCHAIN_SERVICE} / ${workspace}.`);
}

function reportCheck({ team, user, missingScopes }: TokenCheck): void {
  console.log(`The token works: ${user} in ${team}.`);
  if (missingScopes.length)
    console.log(
      `It lacks ${missingScopes.join(", ")}: add them under OAuth & Permissions, then Reinstall to Workspace.`,
    );
}

function configSnippet(workspace: string): string {
  return [
    "Now add the workspace to config/config.yaml and restart the app:",
    "messages:",
    "  slack:",
    `    - workspace: ${workspace}`,
    "      profile: work # the Claude account that summarizes it",
  ].join("\n");
}

main().catch((error: unknown) => {
  console.error(`Slack setup failed: ${errorMessage(error)}`);
  process.exitCode = 1;
});
