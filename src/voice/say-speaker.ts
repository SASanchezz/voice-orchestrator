import { spawn, type ChildProcess } from "node:child_process";
import type { AppConfig } from "../config/app-config.js";
import { toSpeech } from "./speakable.js";

/** macOS `say`, one sentence group at a time; a new one (or your key press) cuts off the old. */
export class SaySpeaker {
  private sayProcess?: ChildProcess;

  constructor(private cfg: AppConfig["voice"]) {}

  speak(text: string): Promise<void> {
    const clean = toSpeech(text);
    if (!clean) return Promise.resolve();
    console.log(`🔊 ${clean}`);
    this.stop();
    const say = spawn("say", this.argsFor(clean), { stdio: "ignore" });
    this.sayProcess = say;
    return new Promise((resolve) => say.once("close", () => resolve()));
  }

  stop(): void {
    this.sayProcess?.kill();
    this.sayProcess = undefined;
  }

  private argsFor(text: string): string[] {
    const args: string[] = [];
    if (this.cfg.sayVoice) args.push("-v", this.cfg.sayVoice);
    if (this.cfg.sayRate) args.push("-r", String(this.cfg.sayRate));
    args.push(text);
    return args;
  }
}
