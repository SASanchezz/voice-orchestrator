import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { HTTP_STATUS, HttpError, sendError } from "./http-error.js";
import type { SiteRouter } from "./site-router.js";
import type { StatePublisher } from "./state-publisher.js";
import type { UiAccess } from "./ui-access.js";

/** Local web UI: live state over server-sent events, actions over POST, on 127.0.0.1 only; VS Code under /editor. */
export class UiServer {
  private server?: Server;

  constructor(
    private router: SiteRouter,
    private publisher: StatePublisher,
    private access: UiAccess,
  ) {}

  /** Starts listening; resolves with the link to open (it carries the token). */
  async start(port: number): Promise<string> {
    await this.router.prepare();
    const server = createServer((req, res) => void this.handle(req, res));
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => this.upgrade(req, socket, head));
    this.server = server;
    this.access.listeningOn(await listen(server, port));
    this.publisher.start();
    return this.link();
  }

  /** The link to open, once started; it carries the token. */
  link(): string {
    return this.access.link();
  }

  stop(): void {
    this.publisher.stop();
    this.server?.close();
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (!this.access.isLocalHost(req.headers.host)) throw new HttpError(HTTP_STATUS.forbidden, "Unexpected host");
      await this.router.route(new URL(req.url ?? "/", "http://local"), req, res);
    } catch (e) {
      sendError(res, e);
    }
  }

  private upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (!this.access.isLocalHost(req.headers.host)) return void socket.destroy();
    this.router.upgrade(req, socket, head);
  }
}

/** Resolves with the port it listens on (port 0 picks a free one). */
async function listen(server: Server, port: number): Promise<number> {
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => ok());
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("The UI server has no TCP port");
  return address.port;
}
