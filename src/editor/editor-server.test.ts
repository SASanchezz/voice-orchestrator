import { test } from "node:test";
import assert from "node:assert/strict";
import type { EditorProcess, ExitListener } from "./editor-process.js";
import { editorCommand, EditorServer, type EditorCommand, type EditorProcesses } from "./editor-server.js";

const SETTINGS = { enabled: true, codePath: "/vscode/code-tunnel", port: 4778 };
const COMMAND: EditorCommand = { bin: "code-tunnel", args: ["serve-web"], port: 4778 };

/** Stands in for the editor's process: the test says when it listens and when it exits. */
class FakeEditorProcess implements EditorProcess {
  readonly pid = 123;
  stopped = false;
  private listen: () => void = () => {};
  private exitListener: ExitListener = () => {};
  readonly ready = new Promise<void>((settle) => (this.listen = settle));

  onExit(listener: ExitListener): void {
    this.exitListener = listener;
  }

  release(): void {}

  stop(): void {
    this.stopped = true;
  }

  async becomeReady(): Promise<void> {
    this.listen();
    await this.ready;
  }

  exit(code: number): void {
    this.exitListener(code);
  }
}

class FakeProcesses implements EditorProcesses {
  readonly editor = new FakeEditorProcess();
  kept?: EditorProcess;

  start(): EditorProcess {
    return this.editor;
  }

  keep(editor: EditorProcess): void {
    this.kept = editor;
  }
}

function startedServer(): { server: EditorServer; processes: FakeProcesses } {
  const processes = new FakeProcesses();
  const server = new EditorServer(COMMAND, processes);
  server.start();
  return { server, processes };
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

test("editor command: it carries the configured port", () => {
  assert.equal(editorCommand(SETTINGS, "/t").port, 4778);
});

test("editor server: it is starting until its port listens", () => {
  const { server } = startedServer();
  assert.equal(server.status, "starting");
});

test("editor server: its port listening makes it ready", async () => {
  const { server, processes } = startedServer();
  await processes.editor.becomeReady();
  assert.equal(server.status, "ready");
});

test("editor server: it has failed once its process exits by itself", () => {
  const { server, processes } = startedServer();
  processes.editor.exit(1);
  server.stop(); // no restart left waiting
  assert.equal(server.status, "failed");
});

test("editor server: stopping stops its process", () => {
  const { server, processes } = startedServer();
  server.stop();
  assert.equal(processes.editor.stopped, true);
});

test("editor server: keeping it running over a restart hands its process on", () => {
  const { server, processes } = startedServer();
  server.keepRunning();
  assert.equal(processes.kept, processes.editor);
});

test("editor server: keeping it running over a restart doesn't stop its process", () => {
  const { server, processes } = startedServer();
  server.keepRunning();
  assert.equal(processes.editor.stopped, false);
});
