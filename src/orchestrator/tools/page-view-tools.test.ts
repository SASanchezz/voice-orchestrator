import { test } from "node:test";
import assert from "node:assert/strict";
import { testConfig } from "../../testing/test-config.js";
import type { ProjectTarget } from "../../ui/page-target.js";
import type { EditorStateName, ServerEvents } from "../../ui/protocol.js";
import { showChanges, showChat, showCode } from "./page-view-tools.js";
import type { ToolResult } from "./tool-kit.js";

const CFG = testConfig({ projects: { webshop: { path: "/w", profile: "personal" } } });

/** Stands in for the open pages; it remembers what they were told. */
class FakePages {
  sent: [keyof ServerEvents, unknown][] = [];

  broadcast<K extends keyof ServerEvents>(event: K, payload: ServerEvents[K]): void {
    this.sent.push([event, payload]);
  }
}

function editorThat(status: EditorStateName): { status: EditorStateName } {
  return { status };
}

function textOf(result: ToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

test("show_code: open pages are told to show the project's code", async () => {
  const pages = new FakePages();
  await showCode(pages, editorThat("ready"), CFG).call({ project: "webshop" });
  const target: ProjectTarget = { view: "code", project: "webshop" };
  assert.deepEqual(pages.sent, [["navigate", target]]);
});

test("show_code: an unknown project is refused", async () => {
  const pages = new FakePages();
  const result = await showCode(pages, editorThat("ready"), CFG).call({ project: "bakery" });
  assert.match(textOf(result), /^Error: No project like "bakery"/);
});

test("show_code: with the editor off, the model reads how to turn it on", async () => {
  const result = await showCode(new FakePages(), editorThat("off"), CFG).call({ project: "webshop" });
  assert.match(textOf(result), /^Error: .*editor\.enabled/);
});

test("show_code: with the editor off, the pages stay where they are", async () => {
  const pages = new FakePages();
  await showCode(pages, editorThat("off"), CFG).call({ project: "webshop" });
  assert.deepEqual(pages.sent, []);
});

test("show_chat: open pages are told to show the project's chat", async () => {
  const pages = new FakePages();
  await showChat(pages, CFG).call({ project: "webshop" });
  const target: ProjectTarget = { view: "chat", project: "webshop" };
  assert.deepEqual(pages.sent, [["navigate", target]]);
});

test("show_changes: open pages are told to review the project's changes", async () => {
  const pages = new FakePages();
  await showChanges(pages, CFG).call({ project: "webshop" });
  const target: ProjectTarget = { view: "review", project: "webshop" };
  assert.deepEqual(pages.sent, [["navigate", target]]);
});
