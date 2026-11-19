import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventSocket } from "./event-socket.js";
import { SlackSocket, type SocketListener } from "./slack-socket.js";

const DOWN_AT = new Date("2026-11-16T10:00:00Z");

class FakeSocket implements EventSocket {
  readonly sent: string[] = [];
  closed = false;
  private heard: (text: string) => void = () => {};
  private whenClosed: () => void = () => {};

  onText(heard: (text: string) => void): void {
    this.heard = heard;
  }

  onClose(closed: () => void): void {
    this.whenClosed = closed;
  }

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closed = true;
    this.whenClosed();
  }

  receive(envelope: object): void {
    this.heard(JSON.stringify(envelope));
  }
}

class Listener implements SocketListener {
  readonly events: unknown[] = [];
  readonly reconnects: Date[] = [];

  heard(event: unknown): void {
    this.events.push(event);
  }

  reconnected(downSince: Date): void {
    this.reconnects.push(downSince);
  }
}

async function connected(): Promise<{ sockets: FakeSocket[]; listener: Listener }> {
  const sockets: FakeSocket[] = [];
  const listener = new Listener();
  const openSocket = async (): Promise<FakeSocket> => sockets[sockets.push(new FakeSocket()) - 1];
  const times = { wait: async () => {}, now: () => DOWN_AT };
  await new SlackSocket(openSocket, listener, times).start();
  return { sockets, listener };
}

const flush = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("slack socket: every envelope is acknowledged", async () => {
  const { sockets } = await connected();
  sockets[0].receive({ type: "events_api", envelope_id: "e1", payload: { event: {} } });
  assert.deepEqual(sockets[0].sent, ['{"envelope_id":"e1"}']);
});

test("slack socket: an event is passed on", async () => {
  const { sockets, listener } = await connected();
  sockets[0].receive({ type: "events_api", envelope_id: "e1", payload: { event: { type: "message" } } });
  assert.deepEqual(listener.events, [{ type: "message" }]);
});

test("slack socket: text that isn't an envelope is ignored", async () => {
  const { sockets, listener } = await connected();
  sockets[0].receive({ nothing: true });
  assert.equal(listener.events.length + sockets[0].sent.length, 0);
});

test("slack socket: Slack's disconnect opens a new connection", async () => {
  const { sockets } = await connected();
  sockets[0].receive({ type: "disconnect" });
  await flush();
  assert.equal(sockets.length, 2);
});

test("slack socket: the first hello isn't a reconnect", async () => {
  const { sockets, listener } = await connected();
  sockets[0].receive({ type: "hello" });
  assert.equal(listener.reconnects.length, 0);
});

test("slack socket: hello after a drop says since when it was down", async () => {
  const { sockets, listener } = await connected();
  sockets[0].close();
  await flush();
  sockets[1].receive({ type: "hello" });
  assert.deepEqual(listener.reconnects, [DOWN_AT]);
});
