import { stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import type { ClipboardSource } from "../../clipboard/clipboard-source.js";
import type { ReferencedPath } from "../../attachments/referenced-paths.js";
import { sendJson } from "./changes-routes.js";
import type { UiAccess } from "./ui-access.js";

const COPIED_FILES_PATH = "/api/clipboard/files";

/** The files and folders copied in Finder or VS Code, whose paths a paste into the message box can write out. */
export class CopiedFilesRoute {
  constructor(
    private access: Pick<UiAccess, "requireToken">,
    private clipboard: ClipboardSource,
  ) {}

  handles(url: URL): boolean {
    return url.pathname === COPIED_FILES_PATH;
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const paths = await this.clipboard.readFiles();
    sendJson(res, await Promise.all(paths.map((path) => CopiedFilesRoute.toView(path))));
  }

  /** A copied file deleted since is told as a file: its path still means what was copied. */
  private static async toView(path: string): Promise<ReferencedPath> {
    const isFolder = await stat(path).then(
      (found) => found.isDirectory(),
      () => false,
    );
    return { path, isFolder };
  }
}
