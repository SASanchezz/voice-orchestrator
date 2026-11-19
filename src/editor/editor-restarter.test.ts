import { test } from "node:test";
import assert from "node:assert/strict";
import type { EditorStateName } from "../ui/protocol.js";
import type { Editor } from "./editor.js";
import { EditorRestarter } from "./editor-restarter.js";

const PORT = 4778;
const portIsFree = (): Promise<boolean> => Promise.resolve(false);

/** Stands in for the editor server: notes what it was asked, and is ready as soon as it starts. */
class FakeServer implements Editor {
  status: EditorStateName = "ready";
  readonly calls: string[] = [];

  start(): void {
    this.calls.push("start");
    this.status = "ready";
  }

  stop(): void {
    this.calls.push("stop");
  }

  keepRunning(): void {
    this.calls.push("keepRunning");
  }
}

function restarterOf(server: Editor): EditorRestarter {
  return new EditorRestarter(server, PORT, portIsFree);
}

test("restart: stops the running server, then starts a new one", async () => {
  const server = new FakeServer();
  await restarterOf(server).restart();
  assert.deepEqual(server.calls, ["stop", "start"]);
});

test("restart: the status says restarting until the new server is ready", async () => {
  const server = new FakeServer();
  const restarter = restarterOf(server);
  const restarting = restarter.restart();
  assert.equal(restarter.status, "restarting");
  await restarting;
});

test("restart: the server's own status shows again once it is done", async () => {
  const restarter = restarterOf(new FakeServer());
  await restarter.restart();
  assert.equal(restarter.status, "ready");
});

test("restart: asking again while restarting doesn't restart twice", async () => {
  const server = new FakeServer();
  const restarter = restarterOf(server);
  await Promise.all([restarter.restart(), restarter.restart()]);
  assert.deepEqual(server.calls, ["stop", "start"]);
});

test("restart: waits for the old server to free its port before starting the new one", async () => {
  const server = new FakeServer();
  let probes = 0;
  const freeOnSecondLook = (): Promise<boolean> => Promise.resolve(probes++ === 0);
  await new EditorRestarter(server, PORT, freeOnSecondLook).restart();
  assert.equal(probes, 2);
});
