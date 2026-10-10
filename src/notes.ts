import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const MAX_NOTE_CHARS = 300;
const SECTION_PREFIX = "## ";

/** Headings a remembered line can go under; a missing one is added at the end of the file. */
export const NOTE_SECTIONS = ["Aliases", "Project notes", "Other"] as const;
export type NoteSection = (typeof NOTE_SECTIONS)[number];

/**
 * The user's notes for the assistant, a Markdown file like CLAUDE.md.
 * Read into the assistant's instructions whenever its session starts; "remember this" adds a line.
 */
export class AssistantNotes {
  constructor(private file: string) {}

  /** The whole file, or "" when there is none. */
  read(): string {
    return existsSync(this.file) ? readFileSync(this.file, "utf8").trim() : "";
  }

  /** Adds one bullet at the end of a section. Returns what happened, in words the assistant can say. */
  remember(note: string, section: NoteSection): string {
    const line = `- ${oneLine(note)}`;
    if (line === "- ") throw new Error("Nothing to remember.");
    const lines = this.read().split("\n");
    if (lines.some((existing) => existing.trim() === line)) return "Already in your notes.";
    this.save(withLine(lines, line, section).join("\n") + "\n");
    return `Saved to your notes under ${section}.`;
  }

  /** Written to a temporary file first, so a crash mid-write can't leave the notes half-written. */
  private save(content: string) {
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, content);
    renameSync(temporary, this.file);
  }
}

function withLine(lines: string[], line: string, section: NoteSection): string[] {
  const heading = lines.findIndex((l) => l.trim() === `${SECTION_PREFIX}${section}`);
  if (heading === -1) return [...trimEnd(lines), "", `${SECTION_PREFIX}${section}`, "", line];
  const nextHeading = lines.findIndex((l, i) => i > heading && l.startsWith(SECTION_PREFIX));
  const sectionEnd = nextHeading === -1 ? lines.length : nextHeading;
  const body = trimEnd(lines.slice(heading + 1, sectionEnd));
  const rest = nextHeading === -1 ? [] : ["", ...lines.slice(nextHeading)];
  const spacer = body.some((l) => l.trim()) ? [] : [""];
  return [...lines.slice(0, heading + 1), ...body, ...spacer, line, ...rest];
}

function trimEnd(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end--;
  return lines.slice(0, end);
}

/** A note is one bullet: line breaks become spaces, and it is kept short. */
function oneLine(note: string): string {
  return note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_CHARS);
}
