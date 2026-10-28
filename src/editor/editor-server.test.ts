import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { editorCommand, EditorServer, type EditorCommand } from "./editor-server.js";

const SETTINGS = { enabled: true, codePath: "/vscode/code-tunnel", port: 4778 };
const COMMAND: EditorCommand = { bin: "code-tunnel", args: ["serve-web"] };

/** Stands in for the editor's process: whatever the test writes is what it prints. */
class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
}

function startedServer(): { server: EditorServer; child: FakeChild } {
  const child = new FakeChild();
  const server = new EditorServer(COMMAND, () => child);
  server.start();
  return { server, child };
}

/** The line, once the server has read it. */
async function print(child: FakeChild, line: string): Promise<void> {
  child.stdout.write(`${line}\n`);
  await new Promise((settle) => setImmediate(settle));
}

test("editor command: serve-web listens on 127.0.0.1 at the configured port", () => {
  const { args } = editorCommand(SETTINGS, "/state/ui-token");
  assert.deepEqual(args.slice(0, 5), ["serve-web", "--host", "127.0.0.1", "--port", "4778"]);
});

test("editor command: it serves under /editor, so the web UI can pass it through", () => {
  const { args } = editorCommand(SETTINGS, "/state/ui-token");
  assert.equal(args[args.indexOf("--server-base-path") + 1], "/editor");
});

test("editor command: the web UI's token file is its connection token", () => {
  const { args } = editorCommand(SETTINGS, "/state/ui-token");
  assert.equal(args[args.indexOf("--connection-token-file") + 1], "/state/ui-token");
});

test("editor command: the configured CLI is run", () => {
  assert.equal(editorCommand(SETTINGS, "/t").bin, "/vscode/code-tunnel");
});

test("editor server: it is starting until the ready line", async () => {
  const { server, child } = startedServer();
  await print(child, "* Visual Studio Code Server");
  assert.equal(server.status, "starting");
});

test("editor server: the ready line makes it ready", async () => {
  const { server, child } = startedServer();
  await print(child, "Web UI available at http://127.0.0.1:4778/editor?tkn=t");
  assert.equal(server.status, "ready");
});

test("editor server: it has failed once its process exits by itself", () => {
  const { server, child } = startedServer();
  child.emit("exit", 1);
  server.stop(); // no restart left waiting
  assert.equal(server.status, "failed");
});
