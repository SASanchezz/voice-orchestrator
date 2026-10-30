import { request, type IncomingMessage, type ServerResponse } from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";
import { text } from "node:stream/consumers";
import type { EditorRoute } from "../ui/server/editor-route.js";
import { EDITOR_BASE_PATH, isEditorPath } from "./editor-url.js";
import { withWorkbenchDefaults } from "./workbench-page.js";

const EDITOR_HOST = "127.0.0.1";
const BAD_GATEWAY = 502;
const NOT_RUNNING = "VS Code isn't running yet.";

/**
 * Passes the editor's requests to its server unchanged, Host included, so VS Code sees the web UI's origin.
 * The editor checks its own connection token, so the web UI's token check isn't repeated here.
 * Only the editor's page itself is changed: it gets `theme` as its default color theme.
 */
export class EditorProxy implements EditorRoute {
  constructor(
    private port: number,
    private theme: string,
  ) {}

  handles(pathname: string): boolean {
    return isEditorPath(pathname);
  }

  forward(req: IncomingMessage, res: ServerResponse): void {
    const isPage = isWorkbenchPage(req);
    // the page is asked for uncompressed, so it can be read and changed
    const headers = isPage ? { ...req.headers, "accept-encoding": "identity" } : req.headers;
    const target = { host: EDITOR_HOST, port: this.port, method: req.method, path: req.url, headers };
    const upstream = request(target, (reply) => {
      if (isPage && isHtml(reply)) void this.sendThemedPage(reply, res);
      else passOn(reply, res);
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

  private async sendThemedPage(reply: IncomingMessage, res: ServerResponse): Promise<void> {
    const page = Buffer.from(withWorkbenchDefaults(await text(reply), this.theme));
    res.writeHead(reply.statusCode ?? BAD_GATEWAY, { ...reply.headers, "content-length": String(page.length) });
    res.end(page);
  }
}

function passOn(reply: IncomingMessage, res: ServerResponse): void {
  res.writeHead(reply.statusCode ?? BAD_GATEWAY, reply.headers);
  reply.pipe(res);
}

/** The editor's page itself, at the editor's base path; everything else it loads lies below it. */
function isWorkbenchPage({ method, url }: IncomingMessage): boolean {
  const pathname = new URL(url ?? "/", "http://editor").pathname;
  return method === "GET" && (pathname === EDITOR_BASE_PATH || pathname === `${EDITOR_BASE_PATH}/`);
}

function isHtml(reply: IncomingMessage): boolean {
  return reply.headers["content-type"]?.startsWith("text/html") ?? false;
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
