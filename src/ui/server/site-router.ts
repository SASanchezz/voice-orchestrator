import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { EditorRoute } from "./editor-route.js";
import type { UiRouter } from "./ui-router.js";

/** The editor's paths go to VS Code; everything else is the web UI's. */
export class SiteRouter {
  constructor(
    private editor: EditorRoute,
    private ui: UiRouter,
  ) {}

  prepare(): Promise<void> {
    return this.ui.prepare();
  }

  async route(url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (this.editor.handles(url.pathname)) return this.editor.forward(req, res);
    await this.ui.route(url, req, res);
  }

  /** Only the editor uses WebSockets. */
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const { pathname } = new URL(req.url ?? "/", "http://local");
    if (!this.editor.handles(pathname)) return void socket.destroy();
    this.editor.upgrade(req, socket, head);
  }
}
