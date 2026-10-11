import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const chatMessageSchema = z.object({
  id: z.number(),
  at: z.string(),
  kind: z.enum(["task", "reply", "tool", "status", "permission"]),
  text: z.string(),
  failed: z.boolean().optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
const chatSchema = z.array(chatMessageSchema);

/** One JSON file per session in state/chats/, holding its chat. */
export class ChatFiles {
  constructor(private dir: string) {}

  read(sessionId: string): ChatMessage[] {
    const file = this.fileOf(sessionId);
    return existsSync(file) ? chatSchema.parse(JSON.parse(readFileSync(file, "utf8"))) : [];
  }

  write(sessionId: string, messages: ChatMessage[]): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.fileOf(sessionId), JSON.stringify(messages));
  }

  remove(sessionId: string): void {
    rmSync(this.fileOf(sessionId), { force: true });
  }

  private fileOf(sessionId: string): string {
    return resolve(this.dir, `${sessionId}.json`);
  }
}
