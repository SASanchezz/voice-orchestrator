import type { AttachmentFiles } from "../../attachments/attachment-files.js";
import type { BrowsedFileView, SavedFileView } from "../../ui/chat-browse-views.js";
import type { ChatBrowsers } from "./chat-browsers.js";

/** Larger files aren't downloaded: they would be held in memory whole. */
export const MAX_FILE_BYTES = 209_715_200; // 200 MiB

/** Which file of which message, in which chat of which source. */
export interface FileAddress {
  source: string;
  chatId: string;
  messageId: string;
  fileId: string;
}

/**
 * Messages' files, downloaded when you open one or make a task, into the attachments folder (kept a week) where a
 * worker can open them by path. Each is downloaded once while it is kept.
 */
export class ChatFiles {
  private saved = new Map<string, SavedFileView>();

  constructor(
    private browsers: ChatBrowsers,
    private attachments: AttachmentFiles,
  ) {}

  async save(address: FileAddress): Promise<SavedFileView> {
    const key = Object.values(address).join("\n");
    const known = this.saved.get(key);
    if (known && this.attachments.has(known.path)) return known;
    const downloaded = await this.download(address);
    this.saved.set(key, downloaded);
    return downloaded;
  }

  /** A file this downloaded and still keeps; any other path is refused. */
  require(path: string): string {
    const isOurs = [...this.saved.values()].some((saved) => saved.path === path);
    if (!isOurs || !this.attachments.has(path)) throw new Error(`No downloaded message file at ${path}.`);
    return path;
  }

  private async download(address: FileAddress): Promise<SavedFileView> {
    const file = await this.fileAt(address);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is over 200 MB, so it isn't downloaded.`);
    const { source, chatId, messageId, fileId } = address;
    const bytes = await this.browsers.browserOf(source).downloadFile(chatId, messageId, fileId);
    const [saved] = this.attachments.save([{ name: file.name, bytes }]);
    return { ...saved, mimeType: file.mimeType };
  }

  /** Only a file of a message you were shown can be downloaded. */
  private async fileAt({ source, chatId, messageId, fileId }: FileAddress): Promise<BrowsedFileView> {
    const messages = await this.browsers.lastReading(source, chatId);
    const file = messages.find((message) => message.id === messageId)?.files.find((each) => each.id === fileId);
    if (!file) throw new Error("That file isn't among the chat's latest messages any more; open the chat again.");
    return file;
  }
}
