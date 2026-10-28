import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

/** Where the editor's requests and WebSockets go, so VS Code shares the web UI's origin and the page may frame it. */
export interface EditorRoute {
  handles(pathname: string): boolean;
  forward(req: IncomingMessage, res: ServerResponse): void;
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
}

/** No editor: no path is the editor's. */
export class NoEditorRoute implements EditorRoute {
  handles(): boolean {
    return false;
  }

  forward(): void {
    throw new Error("The editor is off");
  }

  upgrade(_req: IncomingMessage, socket: Duplex): void {
    socket.destroy();
  }
}
