import { existsSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { errorMessage } from "../shared/errors.js";
import { readSkillFile, type SkillSummary } from "./skill-file.js";

const SKILL_FILE = "SKILL.md";

interface SkillEntry extends SkillSummary {
  file: string;
}

/** The assistant's skills: names and descriptions read once, each playbook read only when it is asked for. */
export class SkillLibrary {
  constructor(private entries: SkillEntry[]) {}

  /** One line per skill, "- name: description". */
  index(): string {
    return this.entries.map(({ name, description }) => `- ${name}: ${description}`).join("\n");
  }

  /** The playbook, read fresh from its SKILL.md; an error naming the known skills if there is none by that name. */
  body(name: string): string {
    const entry = this.entries.find((candidate) => candidate.name === name);
    if (entry) return readSkillFile(entry.file).body;
    const known = this.entries.map((candidate) => candidate.name).join(", ") || "none";
    throw new Error(`No skill "${name}". Known: ${known}.`);
  }
}

/** Every <dir>/<name>/SKILL.md; a broken one is skipped with a warning, so one bad skill doesn't stop the app. */
export function loadSkillLibrary(dir: string): SkillLibrary {
  if (!existsSync(dir)) return new SkillLibrary([]);
  const folders = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const files = folders.map(skillFileOf).filter((file) => existsSync(file));
  return new SkillLibrary(files.flatMap(readEntryOrSkip));
}

function skillFileOf(folder: Dirent): string {
  return join(folder.parentPath, folder.name, SKILL_FILE);
}

function readEntryOrSkip(file: string): SkillEntry[] {
  try {
    return [{ ...readSkillFile(file).summary, file }];
  } catch (error) {
    console.warn(`⚠ skill skipped: ${errorMessage(error)}`);
    return [];
  }
}
