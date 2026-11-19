import { hideSecrets } from "../hidden-secrets.js";

/** Telegram's limit is 4096 characters; Slack's is higher. */
export const MAX_REPLY_CHARS = 4_000;

/** Throws when the text can't go out: empty, too long, or holding what looks like a secret, which is never changed. */
export function requireSendable(text: string): void {
  if (!text.trim()) throw new Error("The reply is empty.");
  if (text.length > MAX_REPLY_CHARS) throw new Error(`The reply is longer than ${MAX_REPLY_CHARS} characters.`);
  if (hideSecrets(text) !== text)
    throw new Error("The reply has something that looks like a password, token or code. Edit it before sending.");
}
