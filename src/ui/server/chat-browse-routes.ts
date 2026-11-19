import type { ServerResponse } from "node:http";
import type { ChatBrowsers } from "../../messages/browse/chat-browsers.js";
import type { ChatFiles } from "../../messages/browse/chat-files.js";
import type { MessageTasks } from "../../messages/browse/message-tasks.js";
import type { TaskDraftView } from "../chat-browse-views.js";
import { HTTP_STATUS } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";

const CHATS_PATH = "/api/chats";
const MESSAGES_PATH = /^\/api\/chats\/([^/]+)\/([^/]+)\/messages$/;
const FILE_PATH = /^\/api\/chats\/([^/]+)\/([^/]+)\/files\/([^/]+)\/([^/]+)$/;
const TASK_DRAFT_PATH = /^\/api\/chats\/([^/]+)\/([^/]+)\/task-draft$/;
const ID_SEPARATOR = ",";

/** What All chats reads: chats and messages, files downloaded when opened, and drafts of tasks made from messages. */
export interface ChatBrowsing {
  browsers: ChatBrowsers;
  files: ChatFiles;
  tasks: MessageTasks;
}

/**
 * The Messages view's All chats over GET. Opening a file downloads it into the attachments folder, and a task draft
 * downloads its messages' files; both only once, so asking again changes nothing.
 */
export class ChatBrowseRoutes {
  constructor(
    private access: UiAccess,
    private browsing: ChatBrowsing,
  ) {}

  handles(url: URL): boolean {
    const paths = [MESSAGES_PATH, FILE_PATH, TASK_DRAFT_PATH];
    return url.pathname === CHATS_PATH || paths.some((path) => path.test(url.pathname));
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const body = await this.bodyFor(url);
    res.writeHead(HTTP_STATUS.ok, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  }

  private bodyFor(url: URL): Promise<unknown> {
    const { browsers, files } = this.browsing;
    const [source, chatId, messageId, fileId] = ChatBrowseRoutes.partsOf(url.pathname);
    if (FILE_PATH.test(url.pathname)) return files.save({ source, chatId, messageId, fileId });
    if (TASK_DRAFT_PATH.test(url.pathname)) return this.taskDraft(url, source, chatId);
    if (MESSAGES_PATH.test(url.pathname)) return browsers.readChat(source, chatId);
    return browsers.allChats();
  }

  private static partsOf(path: string): string[] {
    const match = FILE_PATH.exec(path) ?? TASK_DRAFT_PATH.exec(path) ?? MESSAGES_PATH.exec(path);
    return (match?.slice(1) ?? []).map((part) => decodeURIComponent(part));
  }

  /** The picked messages come comma-separated in `messages`, and the chat's name as the page shows it in `chat`. */
  private taskDraft(url: URL, source: string, chatId: string): Promise<TaskDraftView> {
    const chatName = url.searchParams.get("chat") ?? "";
    const messageIds = (url.searchParams.get("messages") ?? "").split(ID_SEPARATOR).filter(Boolean);
    return this.browsing.tasks.draft({ source, chatId, chatName }, messageIds);
  }
}
