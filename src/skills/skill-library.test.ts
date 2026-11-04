import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadSkillLibrary } from "./skill-library.js";

const GREETING_SKILL = "---\nname: greet\ndescription: Say hello.\n---\n\n# Greet\n\nSay hello warmly.\n";

function skillsDir(skills: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "vo-skills-"));
  for (const [folder, content] of Object.entries(skills)) writeSkill(dir, folder, content);
  return dir;
}

function writeSkill(dir: string, folder: string, content: string): void {
  mkdirSync(join(dir, folder));
  writeFileSync(join(dir, folder, "SKILL.md"), content);
}

test("skill library: the index lists each skill's name and description", () => {
  const library = loadSkillLibrary(skillsDir({ greet: GREETING_SKILL }));
  assert.equal(library.index(), "- greet: Say hello.");
});

test("skill library: a skill's body is the Markdown after its frontmatter", () => {
  const library = loadSkillLibrary(skillsDir({ greet: GREETING_SKILL }));
  assert.equal(library.body("greet"), "# Greet\n\nSay hello warmly.");
});

test("skill library: the body is read when asked for, not at startup", () => {
  const dir = skillsDir({ greet: GREETING_SKILL });
  const library = loadSkillLibrary(dir);
  writeFileSync(join(dir, "greet", "SKILL.md"), GREETING_SKILL.replace("warmly", "briefly"));
  assert.equal(library.body("greet"), "# Greet\n\nSay hello briefly.");
});

test("skill library: an unknown skill is an error naming the known ones", () => {
  const library = loadSkillLibrary(skillsDir({ greet: GREETING_SKILL }));
  assert.throws(() => library.body("wave"), /No skill "wave"\. Known: greet\./);
});

test("skill library: a missing skills folder has no skills", () => {
  assert.equal(loadSkillLibrary(join(tmpdir(), "no-such-skills")).index(), "");
});

test("skill library: a skill without frontmatter is skipped", () => {
  const library = loadSkillLibrary(skillsDir({ greet: GREETING_SKILL, broken: "# No frontmatter\n" }));
  assert.equal(library.index(), "- greet: Say hello.");
});

test("skill library: a skill named unlike its folder is skipped", () => {
  assert.equal(loadSkillLibrary(skillsDir({ hello: GREETING_SKILL })).index(), "");
});

test("skill library: a folder without a SKILL.md is ignored", () => {
  const dir = skillsDir({ greet: GREETING_SKILL });
  mkdirSync(join(dir, "notes"));
  assert.equal(loadSkillLibrary(dir).index(), "- greet: Say hello.");
});
