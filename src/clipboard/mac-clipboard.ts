import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildNativeHelper } from "../macos/native-helper.js";
import { copiedContentSchema, type ClipboardSource, type CopiedContent } from "./clipboard-source.js";

const run = promisify(execFile);
/** Room for a large copied image twice over (PNG and preview), base64 in JSON. */
const MAX_HELPER_OUTPUT_BYTES = 67_108_864; // 64 MiB
const FILES_ONLY = "--files-only";

/** macOS: the general pasteboard, read by native/clipboard.swift. */
export class MacClipboard implements ClipboardSource {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacClipboard> {
    return new MacClipboard(await buildNativeHelper("clipboard"));
  }

  read(): Promise<CopiedContent> {
    return this.runHelper([]);
  }

  async readFiles(): Promise<string[]> {
    const { files = [] } = await this.runHelper([FILES_ONLY]);
    return files;
  }

  private async runHelper(args: string[]): Promise<CopiedContent> {
    const { stdout } = await run(this.helperPath, args, { maxBuffer: MAX_HELPER_OUTPUT_BYTES });
    return copiedContentSchema.parse(JSON.parse(stdout));
  }
}
