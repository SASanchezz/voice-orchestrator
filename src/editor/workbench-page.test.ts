import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withDefaultTheme } from "./workbench-page.js";

const THEME = "Default Dark Modern";

/** A page as `code serve-web` writes it: the startup options as escaped JSON in a meta tag. */
function page(options: object): string {
  const escaped = JSON.stringify(options).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<html><head><meta id="vscode-workbench-web-configuration" data-settings="${escaped}"></head></html>`;
}

/** The startup options in a page, read back. */
function optionsOf(html: string): Record<string, unknown> {
  const escaped = /data-settings="([^"]*)"/.exec(html)?.[1] ?? "";
  const json = escaped.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const parsed: unknown = JSON.parse(json);
  return z.record(z.string(), z.unknown()).parse(parsed);
}

test("workbench page: the editor's default color theme is set", () => {
  const html = withDefaultTheme(page({ remoteAuthority: "127.0.0.1:4777" }), THEME);
  assert.deepEqual(optionsOf(html).configurationDefaults, { "workbench.colorTheme": THEME });
});

test("workbench page: the editor's other startup options are kept", () => {
  const options = { remoteAuthority: "127.0.0.1:4777", serverBasePath: "/editor", folderUri: { path: "/a&b" } };
  const html = withDefaultTheme(page(options), THEME);
  assert.deepEqual(
    { ...optionsOf(html), configurationDefaults: undefined },
    { ...options, configurationDefaults: undefined },
  );
});

test("workbench page: other default settings are kept", () => {
  const html = withDefaultTheme(page({ configurationDefaults: { "editor.fontSize": 15 } }), THEME);
  assert.deepEqual(optionsOf(html).configurationDefaults, { "editor.fontSize": 15, "workbench.colorTheme": THEME });
});

test("workbench page: a page without startup options is left as it is", () => {
  const html = "<html><body>Not found</body></html>";
  assert.equal(withDefaultTheme(html, THEME), html);
});
