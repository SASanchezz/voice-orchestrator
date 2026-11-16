import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { STATE_DIR } from "../config/paths.js";
import type { EditorCommand } from "./editor-server.js";
import { runsCommand, stopGroup } from "./process-group.js";

const keptEditorSchema = z.object({
  pid: z.number().int().positive(),
  bin: z.string(),
  args: z.array(z.string()),
  port: z.number().int().positive(),
});
type KeptEditorRecord = z.infer<typeof keptEditorSchema>;

export function keptEditorPath(): string {
  return resolve(STATE_DIR, "kept-editor.json");
}

/** The editor server left running over a restart, noted in state/ so the next start carries on with it. */
export class KeptEditorFile {
  constructor(private readonly file: string = keptEditorPath()) {}

  save(pid: number, command: EditorCommand): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ pid, ...command }));
  }

  /** Whether the kept editor still runs, serving as this command would. */
  isRunning(command: EditorCommand): boolean {
    if (!this.hasRecord()) return false;
    const kept = this.read();
    return KeptEditorFile.isSameCommand(kept, command) && KeptEditorFile.isServing(kept);
  }

  /** The kept editor's pid; the note is used up, so it is never taken twice. */
  take(): number {
    const { pid } = this.read();
    this.forget();
    return pid;
  }

  /** Stops a kept editor that serves with other settings, so it doesn't hold a port, and forgets it. */
  stopStale(): void {
    if (!this.hasRecord()) return this.forget();
    const kept = this.read();
    if (KeptEditorFile.isServing(kept)) stopGroup(kept.pid);
    this.forget();
  }

  private hasRecord(): boolean {
    if (!existsSync(this.file)) return false;
    return keptEditorSchema.safeParse(this.readJson()).success;
  }

  private read(): KeptEditorRecord {
    return keptEditorSchema.parse(this.readJson());
  }

  private readJson(): unknown {
    try {
      return JSON.parse(readFileSync(this.file, "utf8"));
    } catch {
      return {};
    }
  }

  private forget(): void {
    rmSync(this.file, { force: true });
  }

  private static isSameCommand(kept: KeptEditorRecord, command: EditorCommand): boolean {
    return isDeepStrictEqual({ bin: kept.bin, args: kept.args, port: kept.port }, command);
  }

  private static isServing(kept: KeptEditorRecord): boolean {
    return runsCommand(kept.pid, kept.bin);
  }
}
