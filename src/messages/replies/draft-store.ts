import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { InboundMessage } from "./inbound.js";
import { MESSAGE_KINDS, URGENCIES, type Triage } from "./reply-triage.js";

export const DRAFT_STATUSES = ["ready", "no-reply", "sent", "dismissed"] as const;
/** Older drafts drop off the file so it stays small. */
const MAX_KEPT = 200;

/**
 * A draft and where it goes. The messages it answers are kept only by ID, never their text (Slack's API terms);
 * the text you see is your draft, made by the app.
 */
const draftSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  sourceKey: z.string(),
  source: z.string(),
  chatId: z.string(),
  chatKind: z.enum(["dm", "group-dm", "group"]),
  chatName: z.string(),
  from: z.string(),
  messageIds: z.array(z.string()),
  threadId: z.string().optional(),
  kind: z.enum(MESSAGE_KINDS),
  urgency: z.enum(URGENCIES),
  /** ready: waiting for you; no-reply: the messages need none; sent and dismissed: done with. */
  status: z.enum(DRAFT_STATUSES),
  text: z.string().optional(),
  sentAt: z.iso.datetime().optional(),
});

const draftFileSchema = z.array(draftSchema);

export type Draft = z.infer<typeof draftSchema>;
/** What changes after a draft is made: your edits, and whether it was sent or dismissed. */
export type DraftChange = Partial<Pick<Draft, "text" | "status" | "sentAt">>;

/** How the messages were sorted, and the reply drafted when they need one. */
export interface DraftAnswer {
  triage: Triage;
  text?: string;
}

/** A new draft answering the messages, filed under the chat and thread of the latest one. */
export function newDraft(messages: InboundMessage[], chatName: string, { triage, text }: DraftAnswer): Draft {
  const { sourceKey, source, chatId, chatKind, from, threadId } = messages[messages.length - 1];
  const where = { sourceKey, source, chatId, chatKind, chatName, from, threadId };
  const sorted = { kind: triage.kind, urgency: triage.urgency, status: text ? "ready" : "no-reply" } as const;
  const ids = messages.map((message) => message.messageId);
  return { id: randomUUID(), createdAt: new Date().toISOString(), ...where, messageIds: ids, ...sorted, text };
}

/** state/messages/drafts.json, newest last. A damaged file throws and is never overwritten. */
export class DraftStore {
  constructor(private file: string) {}

  all(): Draft[] {
    if (!existsSync(this.file)) return [];
    try {
      return draftFileSchema.parse(JSON.parse(readFileSync(this.file, "utf8")));
    } catch (error) {
      throw new Error(`the drafts file, ${this.file}, is damaged: fix it or delete it`, { cause: error });
    }
  }

  find(id: string): Draft {
    const draft = this.all().find((candidate) => candidate.id === id);
    if (!draft) throw new Error("That draft is gone: it may be too old.");
    return draft;
  }

  add(draft: Draft): void {
    this.write([...this.all(), draftSchema.parse(draft)].slice(-MAX_KEPT));
  }

  update(id: string, change: DraftChange): Draft {
    const changed = draftSchema.parse({ ...this.find(id), ...change });
    this.write(this.all().map((draft) => (draft.id === id ? changed : draft)));
    return changed;
  }

  private write(kept: Draft[]): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(kept, null, 2)}\n`);
    renameSync(temporary, this.file);
  }
}
