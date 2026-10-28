import type { ServerResponse } from "node:http";
import type { Feed } from "../feed.js";
import type { LiveClients } from "./live-clients.js";
import type { EditorStateView } from "./editor-state-view.js";

const STATE_PUSH_MS = 500;
const HEARTBEAT_MS = 15_000;

/** Keeps every open page current: the full state when it connects, then whenever the state changes. */
export class StatePublisher {
  private lastState = "";

  constructor(
    private clients: LiveClients,
    private view: EditorStateView,
    private feed: Feed,
  ) {}

  /** A page connected: it gets the current state and the assistant's chat so far, then live updates. */
  welcome(res: ServerResponse): void {
    this.clients.open(res);
    this.clients.send(res, "state", this.view.state());
    this.clients.send(res, "backlog", this.feed.recent());
  }

  pushIfChanged(): void {
    const state = JSON.stringify(this.view.state());
    if (state === this.lastState) return;
    this.lastState = state;
    this.clients.broadcastJson("state", state);
  }

  start(): void {
    setInterval(() => this.pushIfChanged(), STATE_PUSH_MS).unref();
    setInterval(() => this.clients.ping(), HEARTBEAT_MS).unref();
  }

  stop(): void {
    this.clients.endAll();
  }
}
