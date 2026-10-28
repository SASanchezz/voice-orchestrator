import { request, type IncomingMessage, type ServerResponse } from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";
import type { EditorRoute } from "../ui/server/editor-route.js";
import { isEditorPath } from "./editor-url.js";

const EDITOR_HOST = "127.0.0.1";
const BAD_GATEWAY = 502;
const NOT_RUNNING = "VS Code isn't running yet.";

/**
 * Passes the editor's requests to its server unchanged, Host included, so VS Code sees the web UI's origin.
 * The editor checks its own connection token, so the web UI's token check isn't repeated here.
 */
export class EditorProxy implements EditorRoute {
  constructor(private port: number) {}

  handles(pathname: string): boolean {
    return isEditorPath(pathname);
  }

  forward(req: IncomingMessage, res: ServerResponse): void {
    const target = { host: EDITOR_HOST, port: this.port, method: req.method, path: req.url, headers: req.headers };
    const upstream = request(target, (reply) => {
      res.writeHead(reply.statusCode ?? BAD_GATEWAY, reply.headers);
      reply.pipe(res);
    });
    upstream.on("error", () => sendNotRunning(res));
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  }

  /** A WebSocket: its upgrade request goes to the editor as it came, then bytes flow both ways. */
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const upstream = connect(this.port, EDITOR_HOST, () => {
      upstream.write(requestHead(req));
      upstream.write(head);
      upstream.pipe(socket).pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    upstream.on("close", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    socket.on("close", () => upstream.destroy());
  }
}

function sendNotRunning(res: ServerResponse): void {
  if (res.headersSent) return void res.destroy();
  res.writeHead(BAD_GATEWAY, { "content-type": "text/plain; charset=utf-8" });
  res.end(NOT_RUNNING);
}

/** The request line and headers, as raw as they arrived. */
function requestHead({ method, url, rawHeaders }: IncomingMessage): string {
  const headers: string[] = [];
  for (let i = 0; i < rawHeaders.length; i += 2) headers.push(`${rawHeaders[i]}: ${rawHeaders[i + 1]}`);
  return [`${String(method)} ${String(url)} HTTP/1.1`, ...headers, "", ""].join("\r\n");
}
