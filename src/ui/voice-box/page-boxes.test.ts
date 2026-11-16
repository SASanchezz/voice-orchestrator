import { test } from "node:test";
import assert from "node:assert/strict";
import type { VoiceBoxNews } from "../voice-box-protocol.js";
import { PageBoxes } from "./page-boxes.js";

const PAGE = "page-1";

/** Stands in for the open pages; it remembers what they were told. */
class FakeClients {
  open = new Set([PAGE]);
  told: VoiceBoxNews[] = [];

  isOpen(page: string): boolean {
    return this.open.has(page);
  }

  broadcast(_event: "voice_box", news: VoiceBoxNews): void {
    this.told.push(news);
  }
}

test("page boxes: a page's box is the same one each time", () => {
  const boxes = new PageBoxes(new FakeClients());
  assert.equal(boxes.of(PAGE), boxes.of(PAGE));
});

test("page boxes: a page's box is open while the page is", () => {
  const clients = new FakeClients();
  const box = new PageBoxes(clients).of(PAGE);
  clients.open.clear();
  assert.equal(box.isOpen(), false);
});

test("page boxes: what a box is told goes to its page only", () => {
  const clients = new FakeClients();
  new PageBoxes(clients).of(PAGE).tell({ kind: "ended" });
  assert.deepEqual(clients.told, [{ page: PAGE, event: { kind: "ended" } }]);
});
