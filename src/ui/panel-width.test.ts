import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PANEL_WIDTH_PX, MIN_PANEL_WIDTH_PX, clampPanelWidth, parsePanelWidth } from "./panel-width.js";

test("a width within the limits is kept, rounded to whole pixels", () => {
  assert.equal(clampPanelWidth(312.6), 313);
});

test("a panel can't be dragged narrower than the minimum", () => {
  assert.equal(clampPanelWidth(20), MIN_PANEL_WIDTH_PX);
});

test("a panel can't be dragged wider than the maximum", () => {
  assert.equal(clampPanelWidth(5000), MAX_PANEL_WIDTH_PX);
});

test("a saved width is read back", () => {
  assert.equal(parsePanelWidth("344"), 344);
});

test("a saved width outside the limits is brought within them", () => {
  assert.equal(parsePanelWidth("9999"), MAX_PANEL_WIDTH_PX);
});

test("nothing saved gives no width", () => {
  assert.equal(parsePanelWidth(undefined), undefined);
});

test("an empty saved value gives no width", () => {
  assert.equal(parsePanelWidth(""), undefined);
});

test("a saved value that isn't a number gives no width", () => {
  assert.equal(parsePanelWidth("wide"), undefined);
});
