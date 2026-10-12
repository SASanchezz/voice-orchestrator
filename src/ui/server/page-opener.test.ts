import { test } from "node:test";
import assert from "node:assert/strict";
import { TestBrowserPage } from "../../testing/test-notices.js";
import type { PageTarget } from "../page-target.js";
import type { ServerEvents } from "../protocol.js";
import { PageOpener } from "./page-opener.js";

const LINK = "http://127.0.0.1:4777/?token=t";
const SESSION_TARGET: PageTarget = { view: "session", sessionId: "s1" };

function pageOpener() {
  const sent: [keyof ServerEvents, unknown][] = [];
  const clients = {
    broadcast: <K extends keyof ServerEvents>(event: K, payload: ServerEvents[K]) => void sent.push([event, payload]),
  };
  const browser = new TestBrowserPage();
  return { opener: new PageOpener(clients, browser, () => LINK), sent, browser };
}

test("page opener: open pages are told where to go", async () => {
  const { opener, sent } = pageOpener();
  await opener.open(SESSION_TARGET);
  assert.deepEqual(sent, [["navigate", SESSION_TARGET]]);
});

test("page opener: the browser gets the link with the target in its hash, for a page that opens fresh", async () => {
  const { opener, browser } = pageOpener();
  await opener.open(SESSION_TARGET);
  assert.deepEqual(browser.focusedLinks, [`${LINK}#open=session:s1`]);
});
