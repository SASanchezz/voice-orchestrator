import { execFile } from "node:child_process";
import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import { loadConfig } from "../../config/load-config.js";
import { keychainWriterOnThisMac } from "../../secrets/keychain-writer.js";
import { errorMessage } from "../../shared/errors.js";
import { TerminalPrompts } from "../../shared/terminal-prompts.js";
import { newAppLink, scopesFor } from "./slack-manifest.js";
import { SLACK_KEYCHAIN_SERVICE } from "./slack-reader.js";
import { checkSlackToken, type TokenCheck } from "./slack-token-check.js";

/** Becomes the Keychain account name, so it is kept to characters that need no quoting. */
const WORKSPACE_NAME = /^[\w.-]+$/;

/**
 * npm run slack-login -- <workspace>: creates the read-only Slack app from a prefilled manifest, checks the pasted
 * token with Slack, and saves it in the Keychain. The token is typed hidden and never printed.
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
  const workspace =
    process.argv[2] ?? (await terminal.ask("Workspace name, as you'll write it in config (e.g. acme): "));
  if (!WORKSPACE_NAME.test(workspace))
    throw new Error("Use letters, digits, dots, dashes or underscores for the name.");
  const configured = configuredWorkspace(workspace);
  const scopes = scopesFor(configured?.channels ?? []);
  showAppSteps(newAppLink(scopes));
  const token = await terminal.askHidden("Paste the User OAuth Token (xoxp-…; it isn't shown): ");
  reportCheck(await checkSlackToken(token, scopes, fetch));
  await keychainWriterOnThisMac().save(SLACK_KEYCHAIN_SERVICE, workspace, token);
  console.log(`Saved in the Keychain as ${SLACK_KEYCHAIN_SERVICE} / ${workspace}.`);
  if (!configured) console.log(configSnippet(workspace));
}

/** The workspace's settings in config/config.yaml, if it is there yet. */
function configuredWorkspace(workspace: string): SlackWorkspaceSettings | undefined {
  try {
    return loadConfig().messages.slack.find((settings) => settings.workspace === workspace);
  } catch {
    return undefined;
  }
}

function showAppSteps(link: string): void {
  console.log(
    [
      '1. Your browser opens Slack\'s "Create an app" page with the app already described (read-only scopes).',
      "   Pick the workspace, then Next › Create. If the browser didn't open, use this link:",
      `   ${link}`,
      "2. Click Install to Workspace › Allow.",
      "3. Under OAuth & Permissions, copy the User OAuth Token.",
    ].join("\n"),
  );
  execFile("open", [link], () => {}); // a missing browser only means the link is used by hand
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
