import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppConfig } from "../config/app-config.js";
import { errorMessage } from "../shared/errors.js";
import { timed } from "../shared/timing.js";

const run = promisify(execFile);

const MAX_BUFFER_BYTES = 1_048_576; // 1 MiB
const NOTHING_SAID = /^\(?(blank_audio|silence|music)\)?$/i;

/** whisper.cpp: a WAV recording in, your words out. */
export class Transcriber {
  constructor(private cfg: AppConfig["voice"]) {}

  /** "" for silence or a failed transcription; the failure is logged. */
  async transcribeOrNothing(wav: string): Promise<string> {
    try {
      return await this.transcribe(wav);
    } catch (e) {
      console.error(`[whisper] ${errorMessage(e)}`);
      return "";
    }
  }

  private async transcribe(wav: string): Promise<string> {
    const args = ["-m", this.cfg.whisperModel, "-f", wav, "-nt", "-np", "-l", this.cfg.language];
    const { stdout } = await timed("whisper", () => run(this.cfg.whisperBin, args, { maxBuffer: MAX_BUFFER_BYTES }));
    const text = stdout
      .replace(/\[.*?\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || NOTHING_SAID.test(text)) return "";
    console.log(`\n🎙  ${text}`);
    return text;
  }
}
