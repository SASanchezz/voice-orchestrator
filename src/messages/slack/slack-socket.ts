import { errorMessage } from "../../shared/errors.js";
import { acknowledgement, ENVELOPE_TYPES, envelopeOf, type Envelope } from "./slack-envelope.js";
import type { EventSocket } from "./event-socket.js";

/** The wait before the first reconnect attempt; it doubles with each failed one, up to the longest. */
const FIRST_RECONNECT_WAIT_MS = 1_000;
const LONGEST_RECONNECT_WAIT_MS = 30_000;

/** Connects to a fresh Socket Mode address; each address works only once. */
export type OpenSocket = () => Promise<EventSocket>;

/** What the socket hands on: each event, and the moment it is back after being down. */
export interface SocketListener {
  heard(event: unknown): void;
  /** Back after a drop that began at `downSince`; Slack redelivers only unacknowledged events, not missed ones. */
  reconnected(downSince: Date): void;
}

export interface SocketTimes {
  wait(ms: number): Promise<void>;
  now(): Date;
}

/**
 * One workspace's Socket Mode connection: acknowledges every envelope at once, passes events on, and when Slack
 * asks to reconnect or the connection drops, opens a new one until it works.
 */
export class SlackSocket {
  private downSince?: Date;

  constructor(
    private openSocket: OpenSocket,
    private listener: SocketListener,
    private times: SocketTimes,
  ) {}

  /** Opens a connection; throws when it can't, e.g. with a revoked token. */
  async start(): Promise<void> {
    const socket = await this.openSocket();
    socket.onText((text) => this.read(socket, text));
    socket.onClose(() => this.dropped());
  }

  private read(socket: EventSocket, text: string): void {
    const envelope = envelopeOf(text);
    if (!envelope) return;
    if (envelope.envelope_id) socket.send(acknowledgement(envelope.envelope_id));
    this.handle(socket, envelope);
  }

  private handle(socket: EventSocket, { type, payload }: Envelope): void {
    if (type === ENVELOPE_TYPES.hello) this.greeted();
    if (type === ENVELOPE_TYPES.disconnect) socket.close();
    if (type === ENVELOPE_TYPES.event && payload) this.listener.heard(payload.event);
  }

  private greeted(): void {
    const downSince = this.downSince;
    this.downSince = undefined;
    if (downSince) this.listener.reconnected(downSince);
  }

  private dropped(): void {
    this.downSince ??= this.times.now();
    void this.reopen();
  }

  private async reopen(): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      await this.times.wait(SlackSocket.reconnectWaitMs(attempt));
      if (await this.openOrLog()) return;
    }
  }

  private static reconnectWaitMs(attempt: number): number {
    return Math.min(FIRST_RECONNECT_WAIT_MS * 2 ** attempt, LONGEST_RECONNECT_WAIT_MS);
  }

  private async openOrLog(): Promise<boolean> {
    try {
      await this.start();
      return true;
    } catch (error) {
      console.warn(`[replies] Slack's live connection is down, trying again: ${errorMessage(error)}`);
      return false;
    }
  }
}
