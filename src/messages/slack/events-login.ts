import { errorMessage } from "../../shared/errors.js";
import { TerminalPrompts } from "../../shared/terminal-prompts.js";
import { saveEventsToken, workspaceName } from "./slack-login-steps.js";

/**
 * npm run slack-events-login -- <workspace>: saves only the app-level (xapp-) token, for a workspace whose user
 * token is already saved. The token is typed hidden and never printed.
 */
async function main(): Promise<void> {
  const terminal = new TerminalPrompts();
  try {
    await saveEventsToken(terminal, await workspaceName(terminal));
  } finally {
    terminal.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Slack setup failed: ${errorMessage(error)}`);
  process.exitCode = 1;
});
