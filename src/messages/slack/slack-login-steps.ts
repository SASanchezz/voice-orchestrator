import { keychainWriterOnThisMac } from "../../secrets/keychain-writer.js";
import type { TerminalPrompts } from "../../shared/terminal-prompts.js";
import { checkEventsToken, SLACK_EVENTS_KEYCHAIN_SERVICE } from "./slack-events-token.js";

/** Becomes the Keychain account name, so it is kept to characters that need no quoting. */
const WORKSPACE_NAME = /^[\w.-]+$/;

/** The workspace name from the command line, or asked for. */
export async function workspaceName(terminal: TerminalPrompts): Promise<string> {
  const workspace =
    process.argv[2] ?? (await terminal.ask("Workspace name, as you'll write it in config (e.g. acme): "));
  if (!WORKSPACE_NAME.test(workspace))
    throw new Error("Use letters, digits, dots, dashes or underscores for the name.");
  return workspace;
}

/** The app-level token only opens the Socket Mode connection that pushes new messages to the app. */
export async function saveEventsToken(terminal: TerminalPrompts, workspace: string): Promise<void> {
  console.log(
    [
      "Under Basic Information › App-Level Tokens, click Generate Token and Scopes,",
      "add the connections:write scope, then Generate, and copy the token (it starts with xapp-).",
    ].join("\n"),
  );
  const token = await terminal.askHidden("Paste the app-level token (xapp-…; it isn't shown): ");
  await checkEventsToken(token, fetch);
  await keychainWriterOnThisMac().save(SLACK_EVENTS_KEYCHAIN_SERVICE, workspace, token);
  console.log(`The app-level token works. Saved in the Keychain as ${SLACK_EVENTS_KEYCHAIN_SERVICE} / ${workspace}.`);
}
