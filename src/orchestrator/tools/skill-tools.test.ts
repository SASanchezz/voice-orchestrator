import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { SKILLS_DIR } from "../../config/paths.js";
import { loadSkillLibrary } from "../../skills/skill-library.js";
import { listSkills, loadSkill } from "./skill-tools.js";
import type { ToolResult } from "./tool-kit.js";

const EXAMPLE_SKILL = "send-screen-page-to-worker";
const library = loadSkillLibrary(SKILLS_DIR);

function textOf(result: ToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function exampleBody(): string {
  const file = readFileSync(join(SKILLS_DIR, EXAMPLE_SKILL, "SKILL.md"), "utf8");
  return file.slice(file.indexOf("\n---\n") + "\n---\n".length).trim();
}

test("skill tools: list_skills gives the example skill's name and description", async () => {
  const listed = textOf(await listSkills(library).call({}));
  assert.match(listed, /^- send-screen-page-to-worker: Passes the page or link the user is looking at/m);
});

test("skill tools: list_skills gives the review-and-commit playbook", async () => {
  const listed = textOf(await listSkills(library).call({}));
  assert.match(listed, /^- review-and-commit: Has a project's worker review its uncommitted changes/m);
});

test("skill tools: load_skill gives the example skill's full body", async () => {
  assert.equal(textOf(await loadSkill(library).call({ name: EXAMPLE_SKILL })), exampleBody());
});

test("skill tools: load_skill tells the model when there is no such skill", async () => {
  assert.match(textOf(await loadSkill(library).call({ name: "nope" })), /^Error: No skill "nope"/);
});
