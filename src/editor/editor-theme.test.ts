import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESKTOP_DEFAULT_THEME, desktopColorTheme } from "./editor-theme.js";

/** A desktop settings file in a temp folder. */
function desktopSettings(content: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "vo-editor-theme-")), "settings.json");
  writeFileSync(file, content);
  return file;
}

test("editor theme: a desktop without a theme setting means VS Code's dark default", () => {
  assert.equal(desktopColorTheme(desktopSettings('{ "editor.tabSize": 2 }')), DESKTOP_DEFAULT_THEME);
});

test("editor theme: the desktop's chosen theme is found, comments and all", () => {
  const settings = '{\n  // mine\n  "editor.tabSize": 2,\n  "workbench.colorTheme": "GitHub Dark Dimmed",\n}';
  assert.equal(desktopColorTheme(desktopSettings(settings)), "GitHub Dark Dimmed");
});

test("editor theme: without desktop VS Code settings, the dark default", () => {
  assert.equal(desktopColorTheme(join(tmpdir(), "vo-no-such-settings.json")), DESKTOP_DEFAULT_THEME);
});
