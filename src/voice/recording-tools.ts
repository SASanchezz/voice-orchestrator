import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { promisify } from "node:util";
import type { AppConfig } from "../config/app-config.js";
import { STATE_DIR } from "../config/paths.js";
import { downloadWhisperModel } from "./whisper-model.js";

const run = promisify(execFile);

/** sox and whisper.cpp are installed, and the whisper model is downloaded. */
export async function prepareRecording(cfg: AppConfig["voice"]): Promise<void> {
  mkdirSync(STATE_DIR, { recursive: true });
  for (const bin of [cfg.recordBin, cfg.whisperBin]) await requireBinary(bin);
  if (!existsSync(cfg.whisperModel)) await downloadWhisperModel(cfg.whisperModel);
}

async function requireBinary(bin: string): Promise<void> {
  try {
    await run("which", [bin]);
  } catch {
    throw new Error(`"${bin}" not found. Run: brew install sox whisper-cpp`);
  }
}
