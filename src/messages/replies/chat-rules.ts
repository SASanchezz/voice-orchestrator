import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { ChatKind, ChatRef } from "./inbound.js";

/** draft: a reply is drafted; notify: only the new-message notice; silent: kept in the inbox; ignore: dropped. */
const MODES = ["draft", "notify", "silent", "ignore"] as const;
const ALERTS = ["popup", "speak", "none"] as const;
const PRIORITIES = ["vip", "normal", "low"] as const;
const RESEARCH = ["allowed", "never"] as const;

/** What you set for one chat; anything left out comes from the defaults for its kind. */
const chatRuleSchema = z.object({
  /** The chat's name when the rule was last changed, only to show it. */
  name: z.string().optional(),
  mode: z.enum(MODES).optional(),
  alert: z.enum(ALERTS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  /** The project a code question in this chat is checked against. */
  project: z.string().optional(),
  research: z.enum(RESEARCH).optional(),
  /** Free text for the drafter, e.g. "formal, English, he's the client". */
  note: z.string().optional(),
});

/** Per source key, per chat ID. */
const rulesFileSchema = z.record(z.string(), z.record(z.string(), chatRuleSchema));

export type ChatRuleChange = z.infer<typeof chatRuleSchema>;
type RulesFile = z.infer<typeof rulesFileSchema>;
type Defaults = Required<Pick<ChatRuleChange, "mode" | "alert" | "priority" | "research">>;
export type ChatRule = Defaults & ChatRuleChange;

/** DMs and group DMs get drafts with a quiet pop-up; groups and channels only the notice. */
const DEFAULTS: Record<ChatKind, Defaults> = {
  dm: { mode: "draft", alert: "popup", priority: "normal", research: "allowed" },
  "group-dm": { mode: "draft", alert: "popup", priority: "normal", research: "allowed" },
  group: { mode: "notify", alert: "popup", priority: "normal", research: "allowed" },
};

/**
 * state/messages/chat-rules.json: read again on every lookup, so a rule changed in the UI, by voice or by hand
 * applies to the next message. A damaged file throws and is never overwritten.
 */
export class ChatRules {
  constructor(private file: string) {}

  ruleFor(chat: ChatRef): ChatRule {
    const saved = this.saved()[chat.sourceKey]?.[chat.chatId] ?? {};
    return { ...DEFAULTS[chat.chatKind], ...saved };
  }

  change(chat: ChatRef, change: ChatRuleChange): void {
    const rules = this.saved();
    const source = rules[chat.sourceKey] ?? {};
    const changed = chatRuleSchema.parse({ ...source[chat.chatId], ...change });
    this.write({ ...rules, [chat.sourceKey]: { ...source, [chat.chatId]: changed } });
  }

  private saved(): RulesFile {
    if (!existsSync(this.file)) return {};
    try {
      return rulesFileSchema.parse(JSON.parse(readFileSync(this.file, "utf8")));
    } catch (error) {
      throw new Error(`the chat rules file, ${this.file}, is damaged: fix it or delete it`, { cause: error });
    }
  }

  private write(rules: RulesFile): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(rules, null, 2)}\n`);
    renameSync(temporary, this.file);
  }
}
