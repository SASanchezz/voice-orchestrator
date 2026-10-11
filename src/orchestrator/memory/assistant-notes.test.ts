import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssistantNotes } from "./assistant-notes.js";

const SEEDED =
  "# Assistant notes\n\n## Aliases\n\n- webshop is also called Webshack.\n\n## Project notes\n\n## Other\n";

/** Where a notes file would go, in a new empty folder. */
function missingNotesFile(): string {
  return join(mkdtempSync(join(tmpdir(), "vo-notes-")), "notes.md");
}

function notesFile(content = SEEDED): string {
  const file = missingNotesFile();
  writeFileSync(file, content);
  return file;
}

test("a missing notes file reads as empty", () => {
  assert.equal(new AssistantNotes(missingNotesFile()).read(), "");
});

test("a remembered line goes at the end of its section", () => {
  const file = notesFile();
  new AssistantNotes(file).remember("dbadmin is also called database admin", "Aliases");
  assert.match(
    readFileSync(file, "utf8"),
    /- webshop is also called Webshack\.\n- dbadmin is also called database admin\n\n## Project notes/,
  );
});

test("a remembered line goes into an empty section", () => {
  const file = notesFile();
  new AssistantNotes(file).remember("webshop stays on work", "Project notes");
  assert.match(readFileSync(file, "utf8"), /## Project notes\n\n- webshop stays on work\n\n## Other/);
});

test("a missing section is added at the end", () => {
  const file = notesFile("# Assistant notes\n");
  new AssistantNotes(file).remember("answer briefly", "Other");
  assert.equal(readFileSync(file, "utf8"), "# Assistant notes\n\n## Other\n\n- answer briefly\n");
});

test("a note spanning several lines is saved as one bullet", () => {
  const file = notesFile();
  new AssistantNotes(file).remember("first\n## Aliases\nsecond", "Other");
  assert.match(readFileSync(file, "utf8"), /## Other\n\n- first ## Aliases second\n$/);
});

test("a line already in the notes is not added twice", () => {
  const notes = new AssistantNotes(notesFile());
  assert.equal(notes.remember("webshop is also called Webshack.", "Aliases"), "Already in your notes.");
});

test("an empty note is refused", () => {
  assert.throws(() => new AssistantNotes(notesFile()).remember("  \n ", "Other"));
});

test("saving leaves no temporary file behind", () => {
  const file = notesFile();
  new AssistantNotes(file).remember("answer briefly", "Other");
  assert.equal(existsSync(`${file}.tmp`), false);
});
