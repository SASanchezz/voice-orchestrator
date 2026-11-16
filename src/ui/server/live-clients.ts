import type { ServerResponse } from "node:http";
import type { ServerEvents } from "../protocol.js";
import { HTTP_STATUS } from "./http-error.js";

/** The open pages, each listening on a server-sent event stream. */
export class LiveClients {
  private clients = new Set<ServerResponse>();
  /** The page each stream belongs to, when it said. */
  private pages = new Map<ServerResponse, string>();

  open(res: ServerResponse, page = ""): void {
    res.writeHead(HTTP_STATUS.ok, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    this.clients.add(res);
    if (page) this.pages.set(res, page);
    res.on("close", () => this.forget(res));
  }

  /** The page's event stream is open: it is still there to be told things. */
  isOpen(page: string): boolean {
    return [...this.pages.values()].includes(page);
  }

  send<K extends keyof ServerEvents>(res: ServerResponse, event: K, payload: ServerEvents[K]): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  broadcast<K extends keyof ServerEvents>(event: K, payload: ServerEvents[K]): void {
    this.clients.forEach((client) => this.send(client, event, payload));
  }

  /** The same event, already serialized, to every page. */
  broadcastJson(event: keyof ServerEvents, json: string): void {
    this.clients.forEach((client) => client.write(`event: ${event}\ndata: ${json}\n\n`));
  }

  /** Keeps idle connections from being closed. */
  ping(): void {
    this.clients.forEach((client) => client.write(": ping\n\n"));
  }

  endAll(): void {
    this.clients.forEach((client) => client.end());
  }

  private forget(res: ServerResponse): void {
    this.clients.delete(res);
    this.pages.delete(res);
  }
}
