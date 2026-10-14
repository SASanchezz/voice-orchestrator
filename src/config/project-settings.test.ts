import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testConfig } from "../testing/test-config.js";
import { setStateDir } from "./paths.js";
import { readProjectOverlay, saveProject } from "./project-overlay.js";
import { ProjectSettings } from "./project-settings.js";

const CONFIG_YAML = `# my config
projects:
  webshop: # the shop
    path: ~/code/webshop
    profile: personal
  # model: opus
  kaggle:
    path: ~/code/kaggle
    profile: personal
`;
const WEBSHOP = { path: "/code/webshop", profile: "personal" };
const KAGGLE = { path: "/code/kaggle", profile: "personal" };

/** Settings over a temporary config.yaml and state folder; both projects are configured. */
function settingsWithTwoProjects() {
  const dir = mkdtempSync(join(tmpdir(), "vo-settings-"));
  setStateDir(join(dir, "state"));
  const configFile = join(dir, "config.yaml");
  writeFileSync(configFile, CONFIG_YAML);
  const cfg = testConfig({ projects: { webshop: WEBSHOP, kaggle: KAGGLE } });
  return { cfg, configFile, settings: new ProjectSettings(cfg, configFile) };
}

test("project settings: a forgotten project leaves the running config", () => {
  const { cfg, settings } = settingsWithTwoProjects();
  settings.forget("webshop");
  assert.deepEqual(Object.keys(cfg.projects), ["kaggle"]);
});

test("project settings: a forgotten project leaves config.yaml, keeping the rest and its comments", () => {
  const { configFile, settings } = settingsWithTwoProjects();
  settings.forget("webshop");
  assert.equal(
    readFileSync(configFile, "utf8"),
    "# my config\nprojects:\n  # model: opus\n  kaggle:\n    path: ~/code/kaggle\n    profile: personal\n",
  );
});

test("project settings: a forgotten project added by voice leaves state/projects.json", () => {
  const { cfg, settings } = settingsWithTwoProjects();
  saveProject(cfg, "notes-app", { path: "/code/notes-app", profile: "personal" });
  settings.forget("notes-app");
  assert.deepEqual(readProjectOverlay(), {});
});

test("project settings: forgetting never deletes the project's folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "vo-folder-"));
  const { cfg, settings } = settingsWithTwoProjects();
  cfg.projects.webshop = { path: dir, profile: "personal" };
  settings.forget("webshop");
  assert.ok(existsSync(dir));
});
