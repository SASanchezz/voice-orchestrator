import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { errorMessage } from "../shared/errors.js";

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

const frontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, digits and dashes, starting with a letter"),
  description: z.string().trim().min(1),
});

/** What the assistant knows about a skill before loading it: its name, and when to use it. */
export type SkillSummary = z.infer<typeof frontmatterSchema>;

/** One skill's SKILL.md: the frontmatter, then the playbook in Markdown. */
export interface SkillFile {
  summary: SkillSummary;
  body: string;
}

/** A SKILL.md that can't be used. */
export class SkillFileError extends Error {}

/** Reads and checks a skill folder's SKILL.md; its name must match the folder, like Claude Code's skills. */
export function readSkillFile(file: string): SkillFile {
  const match = readFileSync(file, "utf8").match(FRONTMATTER);
  if (!match) throw new SkillFileError(`${file} must start with a --- frontmatter block (name, description).`);
  const [, frontmatter = "", body = ""] = match;
  const summary = parseFrontmatter(frontmatter, file);
  const folder = basename(dirname(file));
  if (summary.name !== folder) throw new SkillFileError(`${file} is named "${summary.name}", not "${folder}".`);
  return { summary, body: body.trim() };
}

function parseFrontmatter(frontmatter: string, file: string): SkillSummary {
  const parsed = frontmatterSchema.safeParse(parseYaml(frontmatter, file));
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`);
  throw new SkillFileError(`${file} has a bad frontmatter: ${problems.join("; ")}.`);
}

function parseYaml(frontmatter: string, file: string): unknown {
  try {
    return YAML.parse(frontmatter);
  } catch (error) {
    throw new SkillFileError(`${file}'s frontmatter isn't valid YAML (${errorMessage(error)}).`, { cause: error });
  }
}
