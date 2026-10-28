import type { ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AttachmentFiles } from "../../attachments/attachment-files.js";
import { imageTypeOf } from "../../attachments/image-types.js";
import { APP_DIR } from "../../config/paths.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";
import { bundleWebApp } from "./web-bundle.js";

const PUBLIC_DIR = resolve(APP_DIR, "src/ui/public");
export const SCRIPT_PATH = "/app.js";
export const ATTACHED_IMAGE_PATH = "/api/attachments";
/** Attached files stay for a week and never change. */
const ATTACHED_IMAGE_CACHE = "private, max-age=604800, immutable";
const STATIC_FILES: Record<string, string> = {
  "/styles/base.css": "text/css",
  "/styles/layout.css": "text/css",
  "/styles/sidebar.css": "text/css",
  "/styles/approvals.css": "text/css",
  "/styles/questions.css": "text/css",
  "/styles/chat.css": "text/css",
  "/styles/permission-lines.css": "text/css",
  "/styles/detail.css": "text/css",
  "/styles/dialogs.css": "text/css",
  "/styles/markdown.css": "text/css",
  "/styles/attachments.css": "text/css",
  "/styles/budget.css": "text/css",
  "/styles/todo.css": "text/css",
  "/styles/force-stop.css": "text/css",
  "/styles/code.css": "text/css",
};

/** The page, its script (compiled from src/ui/web/ at start), its stylesheets and the attached images it shows. */
export class PageFiles {
  private script = "";

  constructor(
    private access: UiAccess,
    private attachments: AttachmentFiles,
  ) {}

  async prepare(): Promise<void> {
    this.script = await bundleWebApp();
  }

  page(url: URL, res: ServerResponse): void {
    this.access.requireToken(
      url.searchParams.get("token"),
      "Open the link printed in the terminal (it carries an access token).",
    );
    const html = this.access.withToken(readFileSync(resolve(PUBLIC_DIR, "index.html"), "utf8"));
    res.writeHead(HTTP_STATUS.ok, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
  }

  serveScript(res: ServerResponse): void {
    res.writeHead(HTTP_STATUS.ok, { "content-type": "text/javascript", "cache-control": "no-store" });
    res.end(this.script);
  }

  staticFile(pathname: string, res: ServerResponse): void {
    const type = STATIC_FILES[pathname];
    if (!type) throw new HttpError(HTTP_STATUS.notFound, "Not found");
    res.writeHead(HTTP_STATUS.ok, { "content-type": type, "cache-control": "no-store" });
    res.end(readFileSync(resolve(PUBLIC_DIR, pathname.slice(1))));
  }

  /** An image attached to a message, for its thumbnail in the chat; other attached files are only listed. */
  attachedImage(url: URL, res: ServerResponse): void {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const path = this.attachments.require(url.searchParams.get("path") ?? "");
    const type = imageTypeOf(path);
    if (!type) throw new HttpError(HTTP_STATUS.notFound, "Not an attached image");
    res.writeHead(HTTP_STATUS.ok, {
      "content-type": type,
      "cache-control": ATTACHED_IMAGE_CACHE,
      "x-content-type-options": "nosniff",
    });
    res.end(readFileSync(path));
  }
}
