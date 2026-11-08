// What ⚙ › Messengers shows beside the button. No imports, so the server (Node) and the page (browser) both compile it.

/**
 * `connected`: in config.yaml and logged in, so catch-up reads it. `half`: only one of the two. `off`: neither.
 * `checking` and `failed`: logged in, and the messenger is being asked, or refused the login.
 */
export type MessengerState = "connected" | "checking" | "failed" | "half" | "off";

/** One Slack workspace, or Telegram. */
export interface MessengerStatusView {
  /** As shown, e.g. "Slack acme". */
  name: string;
  state: MessengerState;
  /** What the state means, and what to do when it isn't connected. */
  hint: string;
}
