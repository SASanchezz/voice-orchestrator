import type { SavedAttachment } from "../../attachments/attachment-files.js";
import type { BrowsedMessageView, TaskDraftView } from "../../ui/chat-browse-views.js";
import type { ChatBrowsers } from "./chat-browsers.js";
import type { ChatFiles, FileAddress } from "./chat-files.js";
import { taskDescription, taskTitle, type TaskSource } from "./task-text.js";

/** A chat as the page names it. */
export interface ChatPlace {
  source: string;
  chatId: string;
  chatName: string;
}

/** The saved files, and a note for each one that couldn't be downloaded. */
interface SavedFiles {
  saved: SavedAttachment[];
  missing: string[];
}

/**
 * A to-do item drafted from the messages you picked: their text, who wrote them and when, and their files downloaded
 * for the worker. Nothing is saved as a to-do until you save the dialog.
 */
export class MessageTasks {
  constructor(
    private browsers: ChatBrowsers,
    private files: ChatFiles,
  ) {}

  async draft(place: ChatPlace, messageIds: string[]): Promise<TaskDraftView> {
    const messages = await this.picked(place, messageIds);
    const { saved, missing } = await this.saveFiles(place, messages);
    const where = `${this.browsers.browserOf(place.source).label} › ${place.chatName}`;
    const source: TaskSource = { where, chatName: place.chatName, messages, missingFiles: missing };
    return { title: taskTitle(source), description: taskDescription(source, saved) };
  }

  /** In the chat's order, whatever order they were picked in. */
  private async picked({ source, chatId }: ChatPlace, messageIds: string[]): Promise<BrowsedMessageView[]> {
    const wanted = new Set(messageIds);
    const messages = (await this.browsers.lastReading(source, chatId)).filter((message) => wanted.has(message.id));
    if (!messages.length) throw new Error("Those messages aren't among the chat's latest any more; open it again.");
    return messages;
  }

  /** One file that can't be downloaded (too big, say) doesn't stop the task; it is noted instead. One at a time. */
  private async saveFiles(place: ChatPlace, messages: BrowsedMessageView[]): Promise<SavedFiles> {
    const addresses = messages.flatMap((message) => MessageTasks.fileAddresses(place, message));
    const outcomes: (SavedAttachment | string)[] = [];
    for (const address of addresses) outcomes.push(await this.trySave(address));
    const missing = outcomes.filter((outcome): outcome is string => typeof outcome === "string");
    const saved = outcomes.filter((outcome): outcome is SavedAttachment => typeof outcome !== "string");
    return { saved, missing };
  }

  /** The saved file, or a note saying why it couldn't be. */
  private async trySave(address: FileAddress): Promise<SavedAttachment | string> {
    try {
      return await this.files.save(address);
    } catch (error) {
      return `[a file couldn't be attached: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  private static fileAddresses({ source, chatId }: ChatPlace, message: BrowsedMessageView): FileAddress[] {
    return message.files.map((file) => ({ source, chatId, messageId: message.id, fileId: file.id }));
  }
}
