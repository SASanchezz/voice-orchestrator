import { Api, TelegramClient } from "telegram";
import { FloodWaitError, RPCError } from "telegram/errors/index.js";
import { Logger, LogLevel } from "telegram/extensions/Logger.js";
import { StringSession } from "telegram/sessions/index.js";
import type { Dialog } from "telegram/tl/custom/dialog.js";
import type { Keychain } from "../../secrets/keychain.js";
import {
  LOGIN_AGAIN,
  TelegramWaitError,
  type TelegramChat,
  type TelegramChats,
  type TelegramMessage,
} from "./telegram-port.js";
import { chatKind, senderName } from "./telegram-names.js";

export const TELEGRAM_KEYCHAIN_SERVICE = "voice-orchestrator.telegram";
export const KEYCHAIN_ACCOUNTS = { apiId: "api-id", apiHash: "api-hash", session: "session" } as const;
const CONNECTION_RETRIES = 3;
const MAX_DIALOGS = 500;
const MS_PER_SECOND = 1000;
/** Telegram's errors for a session that no longer works. */
const SIGNED_OUT = new Set([
  "AUTH_KEY_UNREGISTERED",
  "AUTH_KEY_INVALID",
  "SESSION_REVOKED",
  "SESSION_EXPIRED",
  "USER_DEACTIVATED",
]);

/** Connects as you, with the api-id, api-hash and session saved in the Keychain by npm run telegram-login. */
export async function openTelegram(keychain: Keychain): Promise<TelegramChats> {
  const client = await telegramClient(keychain);
  await translated(async () => client.connect());
  if (await translated(async () => client.checkAuthorization())) return new TelegramReader(client);
  await client.destroy();
  throw new Error(LOGIN_AGAIN);
}

/** The client before it connects; the login script shares it. */
export async function telegramClient(keychain: Keychain): Promise<TelegramClient> {
  if (!(await keychain.has(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.apiHash))) throw new Error(LOGIN_AGAIN);
  const apiId = Number(await keychain.read(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.apiId));
  const apiHash = await keychain.read(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.apiHash);
  const session = await keychain.read(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.session).catch(() => "");
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: CONNECTION_RETRIES,
    floodSleepThreshold: 0, // FloodWaits come back to us, to wait out only the short ones
    baseLogger: new Logger(LogLevel.NONE),
  });
}

/**
 * The only way the app reaches Telegram: the client is private, and only getDialogs and getMessages are called.
 * Neither marks anything as read. Secret chats live only on your devices, so they never show up here.
 */
class TelegramReader implements TelegramChats {
  private peers = new Map<string, Api.TypeInputPeer>();

  constructor(private client: TelegramClient) {}

  async listChats(): Promise<TelegramChat[]> {
    const dialogs = await translated(async () => this.client.getDialogs({ limit: MAX_DIALOGS }));
    for (const dialog of dialogs) this.peers.set(idOf(dialog), dialog.inputEntity);
    return dialogs.map(chatOf);
  }

  async readMessages(chatId: string, afterId: number, limit: number): Promise<TelegramMessage[]> {
    const peer = this.peers.get(chatId);
    if (!peer) throw new Error(`chat ${chatId} isn't in the chat list`);
    const messages = await translated(async () => this.client.getMessages(peer, { minId: afterId, limit }));
    return messages.toReversed().map(messageOf);
  }

  async close(): Promise<void> {
    await this.client.destroy();
  }
}

function idOf(dialog: Dialog): string {
  return dialog.id?.toString() ?? "";
}

function chatOf(dialog: Dialog): TelegramChat {
  return {
    id: idOf(dialog),
    name: dialog.name ?? dialog.title ?? idOf(dialog),
    kind: chatKind(dialog),
    unreadCount: dialog.unreadCount,
    lastMessageId: dialog.message?.id ?? dialog.dialog.topMessage,
    readInboxMaxId: dialog.dialog.readInboxMaxId,
  };
}

function messageOf(message: Api.Message): TelegramMessage {
  return {
    id: message.id,
    from: senderName(message),
    sentAt: new Date(message.date * MS_PER_SECOND),
    text: message.message ?? "",
    hasMedia: hasAttachment(message.media),
  };
}

/** A link preview isn't an attachment; photos, files, voice notes and the like are. */
function hasAttachment(media: Api.TypeMessageMedia | undefined): boolean {
  return (
    media !== undefined && !(media instanceof Api.MessageMediaWebPage) && !(media instanceof Api.MessageMediaEmpty)
  );
}

/** GramJS errors as the app's: FloodWait to TelegramWaitError, a revoked session to "run npm run telegram-login". */
async function translated<Result>(request: () => Promise<Result>): Promise<Result> {
  try {
    return await request();
  } catch (error) {
    throw appError(error);
  }
}

function appError(error: unknown): unknown {
  if (error instanceof FloodWaitError) return new TelegramWaitError(error.seconds);
  if (error instanceof RPCError && SIGNED_OUT.has(error.errorMessage)) return new Error(LOGIN_AGAIN);
  return error;
}
