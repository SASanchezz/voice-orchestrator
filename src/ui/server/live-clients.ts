import type { ServerResponse } from "node:http";
import type { ServerEvents } from "../protocol.js";
import { HTTP_STATUS } from "./http-error.js";

/** The open pages, each listening on a server-sent event stream. */
export class LiveClients {
  private clients = new Set<ServerResponse>();

  open(res: ServerResponse): void {
    res.writeHead(HTTP_STATUS.ok, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
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
}
