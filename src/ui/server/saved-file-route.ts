import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import type { ChatFiles } from "../../messages/browse/chat-files.js";
import { HTTP_STATUS } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";

export const SAVED_FILE_PATH = "/api/chats/saved-file";

/**
 * A message's file once downloaded, for the page to play or show. It is sent as a download the browser never renders
 * itself, so a file can't run as a page on the app's address; the page shows it from a blob with its real type.
 */
export class SavedFileRoute {
  constructor(
    private access: UiAccess,
    private files: ChatFiles,
  ) {}

  handles(url: URL): boolean {
    return url.pathname === SAVED_FILE_PATH;
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const path = this.files.require(url.searchParams.get("path") ?? "");
    res.writeHead(HTTP_STATUS.ok, {
      "content-type": "application/octet-stream",
      "content-disposition": "attachment",
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    });
    res.end(readFileSync(path));
  }
}
