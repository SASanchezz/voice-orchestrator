import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_QUICK_PANEL_HOTKEY, quickPanelHotkeySchema } from "./quick-panel-config.js";

test("a missing key combo gets the default", () => {
  assert.equal(quickPanelHotkeySchema.parse(undefined), DEFAULT_QUICK_PANEL_HOTKEY);
});

test("a key left empty in YAML gets the default", () => {
  assert.equal(quickPanelHotkeySchema.parse(null), DEFAULT_QUICK_PANEL_HOTKEY);
});

test("a combo is read in any case", () => {
  assert.equal(quickPanelHotkeySchema.parse("Cmd+Shift+K"), "cmd+shift+k");
});

test("a key without a modifier is refused, since it would swallow your typing", () => {
  assert.throws(() => quickPanelHotkeySchema.parse("space"));
});

test("an unknown key name is refused", () => {
  assert.throws(() => quickPanelHotkeySchema.parse("ctrl+banana"));
});
