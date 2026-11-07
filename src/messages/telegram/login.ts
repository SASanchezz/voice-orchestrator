import type { TelegramClient } from "telegram";
import { keychainOnThisMac, type Keychain } from "../../secrets/keychain.js";
import { keychainWriterOnThisMac, type KeychainWriter } from "../../secrets/keychain-writer.js";
import { errorMessage } from "../../shared/errors.js";
import { TerminalPrompts } from "../../shared/terminal-prompts.js";
import { KEYCHAIN_ACCOUNTS, telegramClient, TELEGRAM_KEYCHAIN_SERVICE } from "./telegram-reader.js";

/** Telegram's errors for a mistyped code or password, which are asked again; anything else stops the login. */
const RETRYABLE = /PHONE_CODE_INVALID|PASSWORD_HASH_INVALID/;
const API_ID = /^\d+$/;
const API_HASH = /^[0-9a-f]{32}$/;

/**
 * npm run telegram-login: saves your app's api-id and api-hash if they aren't in the Keychain yet, signs this app
 * in to your Telegram account, and saves the session. Secrets are typed hidden, never printed, and reach the
 * Keychain through `security -i` on stdin.
 */
async function main(): Promise<void> {
  const terminal = new TerminalPrompts();
  try {
    const keychain = keychainOnThisMac();
    const writer = keychainWriterOnThisMac();
    await saveAppCredentials(keychain, writer, terminal);
    await signIn(await telegramClient(keychain), writer, terminal);
  } finally {
    terminal.close();
  }
}

async function saveAppCredentials(
  keychain: Keychain,
  writer: KeychainWriter,
  terminal: TerminalPrompts,
): Promise<void> {
  const hasId = await keychain.has(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.apiId);
  const hasHash = await keychain.has(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.apiHash);
  if (hasId && hasHash) return;
  console.log("At https://my.telegram.org › API development tools, create an app (any name) and copy its values.");
  const apiId = await terminal.ask("App api_id (digits): ");
  if (!API_ID.test(apiId)) throw new Error("api_id is a number, e.g. 1234567.");
  const apiHash = await terminal.askHidden("App api_hash (32 characters; it isn't shown): ");
  if (!API_HASH.test(apiHash)) throw new Error("api_hash is 32 characters of 0-9 and a-f.");
  await writer.save(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.apiId, apiId);
  await writer.save(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.apiHash, apiHash);
}

async function signIn(client: TelegramClient, writer: KeychainWriter, terminal: TerminalPrompts): Promise<void> {
  await client.start({
    phoneNumber: async () => terminal.ask("Phone number, with country code: "),
    phoneCode: async () => terminal.ask("The code Telegram sent you: "),
    password: async () => terminal.askHidden("Your two-step verification password (it isn't shown): "),
    onError: async (error) => reportLoginError(error),
  });
  const session: unknown = client.session.save();
  if (typeof session !== "string") throw new Error("Telegram gave no session to save.");
  await writer.save(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.session, session);
  await client.destroy();
  console.log("Logged in. The session is saved in the Keychain; the app can now read Telegram.");
}

/** Stops the login unless the code or password was only mistyped. */
function reportLoginError(error: Error): boolean {
  console.error(`Telegram: ${errorMessage(error)}`);
  return !RETRYABLE.test(errorMessage(error));
}

main().catch((error: unknown) => {
  console.error(`Telegram login failed: ${errorMessage(error)}`);
  process.exitCode = 1;
});
