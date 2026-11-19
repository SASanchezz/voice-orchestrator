import { z } from "zod";
import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import type { Keychain } from "../../secrets/keychain.js";
import { errorMessage } from "../../shared/errors.js";
import type { SetupCheck } from "../../ui/reply-checkup-views.js";
import type { EventSocket } from "./event-socket.js";
import type { FetchFn } from "./slack-client.js";
import { SLACK_EVENTS_KEYCHAIN_SERVICE, socketUrl } from "./slack-events-token.js";
import { appFor } from "./slack-manifest.js";
import { SLACK_KEYCHAIN_SERVICE } from "./slack-reader.js";
import { checkSlackToken } from "./slack-token-check.js";

/** How long the checkup waits for Slack's hello on a test connection. */
const HELLO_WAIT_MS = 8_000;

const helloSchema = z.object({
  type: z.literal("hello"),
  connection_info: z.object({ app_id: z.string() }).optional(),
});

/** A workspace's tokens, permissions and live connection, each tried with Slack now. Tokens are never shown. */
export class SlackSetupCheck {
  constructor(
    private keychain: Keychain,
    private fetchFn: FetchFn,
    private connect: (url: string) => EventSocket,
  ) {}

  async check(settings: SlackWorkspaceSettings): Promise<SetupCheck[]> {
    return [await this.userToken(settings), await this.appToken(settings.workspace)];
  }

  private async userToken(settings: SlackWorkspaceSettings): Promise<SetupCheck> {
    const label = "User token and permissions";
    const command = `npm run slack-login -- ${settings.workspace}`;
    if (!(await this.keychain.has(SLACK_KEYCHAIN_SERVICE, settings.workspace)))
      return { label, status: "fail", detail: "No user token (xoxp-) is saved.", fix: "Run the login:", command };
    try {
      const token = await this.keychain.read(SLACK_KEYCHAIN_SERVICE, settings.workspace);
      const { team, user, missingScopes } = await checkSlackToken(token, appFor(settings).scopes, this.fetchFn);
      if (!missingScopes.length)
        return { label, status: "ok", detail: `Works as ${user} in ${team}, with every permission needed.` };
      const fix = "Add them under OAuth & Permissions › User Token Scopes, Reinstall to Workspace, then run:";
      return { label, status: "fail", detail: `It lacks ${missingScopes.join(", ")}.`, fix, command };
    } catch (error) {
      return { label, status: "fail", detail: errorMessage(error), fix: "Log in again:", command };
    }
  }

  private async appToken(workspace: string): Promise<SetupCheck> {
    const label = "Live connection (app-level token)";
    const command = `npm run slack-events-login -- ${workspace}`;
    if (!(await this.keychain.has(SLACK_EVENTS_KEYCHAIN_SERVICE, workspace)))
      return { label, status: "fail", detail: "No app-level token (xapp-) is saved.", fix: "Save it:", command };
    try {
      const appId = await this.testConnection(workspace);
      const detail = `Slack answered a test connection${appId ? ` for app ${appId}` : ""}.`;
      return { label, status: "ok", detail };
    } catch (error) {
      return {
        label,
        status: "fail",
        detail: errorMessage(error),
        fix: "Check that Socket Mode is on, then save the token again:",
        command,
      };
    }
  }

  private async testConnection(workspace: string): Promise<string | undefined> {
    const token = await this.keychain.read(SLACK_EVENTS_KEYCHAIN_SERVICE, workspace);
    return this.hello(await socketUrl(token, this.fetchFn));
  }

  /** Opens a test connection and waits for Slack's hello; the app it names is the one sending new messages. */
  private async hello(url: string): Promise<string | undefined> {
    const socket = this.connect(url);
    try {
      return await new Promise<string | undefined>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Slack didn't answer the test connection")), HELLO_WAIT_MS);
        socket.onText((text) => {
          const hello = helloSchema.safeParse(JSON.parse(text));
          if (!hello.success) return;
          clearTimeout(timer);
          resolve(hello.data.connection_info?.app_id);
        });
      });
    } finally {
      socket.close();
    }
  }
}
