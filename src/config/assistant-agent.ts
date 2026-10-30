import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { errorMessage } from "../shared/errors.js";
import { APP_DIR } from "./paths.js";

/** The rules the assistant must have, one section each; a definition missing any of them is refused. */
export const REQUIRED_SECTIONS = [
  "Project and session routing",
  "Requirement clarity",
  "New session or continuation",
  "Task type",
] as const;

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const SECTION_HEADING = /^## (.+)$/gm;

const frontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, digits and dashes, starting with a letter"),
  description: z.string().trim().min(1),
});

/** The specialized agent every assistant chat runs as: its name, when it applies, and its rules. */
export interface AssistantAgent {
  name: string;
  description: string;
  /** The Markdown after the frontmatter, with every required section. */
  instructions: string;
  /** Where it was read from, relative to the app's folder. */
  source: string;
}

/** A definition that can't be used: the app must not start with it. */
export class AssistantAgentError extends Error {}

/** Reads and checks the agent definition; throws an AssistantAgentError naming every problem it finds. */
export function loadAssistantAgent(file: string): AssistantAgent {
  const source = relative(APP_DIR, file);
  if (!existsSync(file)) throw new AssistantAgentError(`${source} is missing.`);
  const match = readFileSync(file, "utf8").match(FRONTMATTER);
  if (!match) throw new AssistantAgentError(`${source} must start with a --- frontmatter block (name, description).`);
  const [, frontmatter = "", instructions = ""] = match;
  const { name, description } = parseFrontmatter(frontmatter, source);
  requireSections(instructions, source);
  return { name, description, instructions: instructions.trim(), source };
}

function parseFrontmatter(frontmatter: string, source: string): z.infer<typeof frontmatterSchema> {
  const parsed = frontmatterSchema.safeParse(parseYaml(frontmatter, source));
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`);
  throw new AssistantAgentError(`${source} has a bad frontmatter: ${problems.join("; ")}.`);
}

function parseYaml(frontmatter: string, source: string): unknown {
  try {
    return YAML.parse(frontmatter);
  } catch (error) {
    throw new AssistantAgentError(`${source}'s frontmatter isn't valid YAML (${errorMessage(error)}).`, {
      cause: error,
    });
  }
}

/** Each required section must be there, under its own "## " heading, with something under it. */
function requireSections(instructions: string, source: string): void {
  const bodies = sectionBodies(instructions);
  const missing = REQUIRED_SECTIONS.filter((section) => !bodies.get(section));
  if (missing.length) throw new AssistantAgentError(`${source} lacks the sections: ${missing.join(", ")}.`);
}

function sectionBodies(instructions: string): Map<string, string> {
  const headings = [...instructions.matchAll(SECTION_HEADING)];
  return new Map(headings.map((heading, at) => sectionOf(instructions, heading, headings[at + 1])));
}

/** A section's title, and its text up to the next heading. */
function sectionOf(instructions: string, heading: RegExpExecArray, next?: RegExpExecArray): [string, string] {
  const start = heading.index + heading[0].length;
  const body = instructions.slice(start, next?.index ?? instructions.length).trim();
  return [heading[1]?.trim() ?? "", body];
}
