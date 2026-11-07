import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { errorMessage } from "../shared/errors.js";

const idMap = z.record(z.string(), z.string());

/** Where a source stopped reading: only timestamps and IDs, never message text. */
const sourceCursorSchema = z.object({
  /** When the source was last caught up on in full. */
  checkedAt: z.iso.datetime().optional(),
  /** Per chat ID: the last message read (a Slack ts or a Telegram message ID). */
  chats: idMap.default({}),
  /** Per chat name from config: the chat ID it was first matched to, so a rename doesn't lose it. */
  namedChatIds: idMap.default({}),
});

const cursorFileSchema = z.record(z.string(), sourceCursorSchema);

export type SourceCursor = z.infer<typeof sourceCursorSchema>;
type CursorFile = z.infer<typeof cursorFileSchema>;

export const EMPTY_CURSOR: SourceCursor = { chats: {}, namedChatIds: {} };

/**
 * state/messages/cursors.json, read at the first catch-up (not at startup, so a damaged file never stops the app)
 * and written whenever a source moves forward.
 */
export class MessageCursors {
  private loaded?: CursorFile;

  constructor(private file: string) {}

  of(source: string): SourceCursor {
    return this.saved()[source] ?? EMPTY_CURSOR;
  }

  save(source: string, cursor: SourceCursor): void {
    const next = { ...this.saved(), [source]: cursor };
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(temporary, this.file);
    this.loaded = next;
  }

  /** A damaged file is read again on the next catch-up, so fixing or deleting it works without a restart. */
  private saved(): CursorFile {
    this.loaded ??= existsSync(this.file) ? readCursorFile(this.file) : {};
    return this.loaded;
  }
}

/** A damaged file stops message reading with a clear error, and is never overwritten, rather than silently starting over. */
function readCursorFile(file: string): CursorFile {
  try {
    return cursorFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    throw new Error(damagedFileText(file, error), { cause: error });
  }
}

function damagedFileText(file: string, error: unknown): string {
  return (
    `the file where message reading remembers its place, ${file}, is damaged (${damageOf(error)}). ` +
    "Fix it, or delete it to start over: the next catch-up then reads the last day of Slack and your unread Telegram messages"
  );
}

/** Short enough to be spoken: zod's own report is a multi-line listing. */
function damageOf(error: unknown): string {
  return error instanceof z.ZodError ? "its contents aren't in the expected shape" : errorMessage(error);
}
