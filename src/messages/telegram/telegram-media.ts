import { Api, type TelegramClient } from "telegram";
import type { MessageFile } from "./telegram-port.js";

const PHOTO_TYPE = "image/jpeg";
const UNKNOWN_TYPE = "application/octet-stream";
/** A file's name when Telegram gives none: its kind and the message it came in, with an extension from its type. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

/** A link preview isn't an attachment; photos, files, voice notes and the like are. */
export function hasAttachment(media: Api.TypeMessageMedia | undefined): boolean {
  return (
    media !== undefined && !(media instanceof Api.MessageMediaWebPage) && !(media instanceof Api.MessageMediaEmpty)
  );
}

/** The message's photo or document, named and typed; other media (polls, places, contacts) carry no file. */
export function fileOf(message: Api.Message): MessageFile | undefined {
  const { media } = message;
  if (media instanceof Api.MessageMediaPhoto)
    return { name: nameFor(message.id, PHOTO_TYPE), mimeType: PHOTO_TYPE, size: 0 };
  if (media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document) {
    return documentFile(message.id, media.document);
  }
  return undefined;
}

/** The whole file of one message; a message without one is refused. */
export async function downloadMessageFile(
  client: TelegramClient,
  peer: Api.TypeInputPeer,
  messageId: number,
): Promise<Buffer> {
  const [message] = await client.getMessages(peer, { ids: [messageId] });
  if (!message?.media) throw new Error(`Telegram message ${messageId} has no file.`);
  const downloaded = await client.downloadMedia(message, {});
  if (!Buffer.isBuffer(downloaded)) throw new Error(`Telegram didn't send the file of message ${messageId}.`);
  return downloaded;
}

function documentFile(messageId: number, document: Api.Document): MessageFile {
  const mimeType = document.mimeType || UNKNOWN_TYPE;
  const named = document.attributes.find((attribute) => attribute instanceof Api.DocumentAttributeFilename);
  const name = named instanceof Api.DocumentAttributeFilename ? named.fileName : nameFor(messageId, mimeType);
  return { name, mimeType, size: document.size.toJSNumber() };
}

function nameFor(messageId: number, mimeType: string): string {
  const kind = mimeType.split("/")[0] || "file";
  const extension = EXTENSIONS[mimeType];
  return extension ? `${kind}-${messageId}.${extension}` : `${kind}-${messageId}`;
}
