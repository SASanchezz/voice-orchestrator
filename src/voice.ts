import { spawn, execFile, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdirSync, rmSync, existsSync, createWriteStream, renameSync } from "node:fs";
import { dirname, basename } from "node:path";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { STATE_DIR, type AppConfig } from "./config.js";
import type { MacHotkey } from "./hotkey.js";
import { UtteranceMerger } from "./utterance-merger.js";

const run = promisify(execFile);

/** Longer than anyone holds push-to-talk; past this the key's release was missed. */
const MAX_RECORDING_MS = 90_000;
const RECORDER_STOP_GRACE_MS = 2000;
/** Shorter presses are accidental taps; nothing is transcribed. */
const MIN_RECORDING_MS = 400;

/** idle; recording while the key is held; held while your words are transcribed and kept a moment in case you continue. */
export type VoiceInputState = "idle" | "recording" | "held";

interface Recording {
  /** Its place in the message being held, see UtteranceMerger. */
  slot: number;
  wav: string;
  startedAt: number;
  recorder: ChildProcess;
  /** Fires if the key's release never arrives. */
  limit: NodeJS.Timeout;
}

export interface VoiceIO {
  onUtterance(cb: (text: string) => void): void;
  /** Fires the moment you start talking, before your words are known. */
  onPress(cb: () => void): void;
  speak(text: string): Promise<void>;
  stopSpeaking(): void;
  /** True from key press until your words are sent: events wait so Claude never talks over you or answers ahead of you. */
  isListening(): boolean;
  inputState(): VoiceInputState;
  start(): Promise<void>;
}

/** Make model output speakable: drop markdown, code, URLs. */
export function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (code omitted) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/[*_#>|]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Homebrew's whisper-cpp ships without models. Fetch the one named in config
 * (e.g. ggml-small.en.bin) from the official whisper.cpp model repo, once.
 */
export async function downloadWhisperModel(path: string) {
  const name = basename(path);
  if (!/^ggml-[\w.-]+\.bin$/.test(name))
    throw new Error(`Whisper model not found at ${path}, and "${name}" isn't a standard model name to download. Put the file there or fix voice.whisperModel.`);
  const base = process.env.VO_WHISPER_MODEL_BASE ?? "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
  const url = `${base}/${name}`;
  console.log(`Whisper model missing; downloading ${name} (one time) to ${path}`);
  mkdirSync(dirname(path), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) from ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const tmp = `${path}.part`;
  const out = createWriteStream(tmp);
  let got = 0, lastPct = -1;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
    got += chunk.length;
    const pct = total ? Math.floor((got / total) * 100) : -1;
    if (pct !== lastPct && pct % 5 === 0) {
      process.stdout.write(`\r  ${pct}%  ${(got / 1e6).toFixed(0)}/${(total / 1e6).toFixed(0)} MB`);
      lastPct = pct;
    }
  }
  await new Promise<void>((r, j) => out.end((e?: Error) => (e ? j(e) : r())));
  if (total && got !== total) throw new Error(`Download incomplete (${got}/${total} bytes); run again.`);
  renameSync(tmp, path); // only a complete file ever lands at the real path
  console.log("\n  done.");
}

/** macOS: hold hotkey -> sox records -> release -> whisper.cpp -> text. Speech via `say`. */
export class MacVoice implements VoiceIO {
  private cb: (t: string) => void = () => {};
  private pressCb: () => void = () => {};
  private current?: Recording;
  private recordingCount = 0;
  private sayProc?: ChildProcess;
  private merger: UtteranceMerger;

  constructor(
    private cfg: AppConfig["voice"],
    private hotkey: MacHotkey,
  ) {
    this.merger = new UtteranceMerger(cfg.mergeWindowSeconds * 1000, (message) => this.cb(message));
  }

  onUtterance(cb: (text: string) => void) {
    this.cb = cb;
  }

  onPress(cb: () => void) {
    this.pressCb = cb;
  }

  isListening() {
    return this.inputState() !== "idle";
  }

  inputState(): VoiceInputState {
    if (this.current) return "recording";
    return this.merger.isHolding() ? "held" : "idle";
  }

  async start() {
    mkdirSync(STATE_DIR, { recursive: true });
    for (const bin of [this.cfg.recordBin, this.cfg.whisperBin]) {
      try {
        await run("which", [bin]);
      } catch {
        throw new Error(`"${bin}" not found. Run: brew install sox whisper-cpp`);
      }
    }
    if (!existsSync(this.cfg.whisperModel)) await downloadWhisperModel(this.cfg.whisperModel);

    await this.hotkey.start(
      () => {
        if (!this.current) this.beginRecording();
      },
      () => {
        if (this.current) void this.endRecording();
      },
    );
    console.log(`Hold ${this.cfg.hotkey} to talk. Ctrl+C to quit.`);
  }

  private beginRecording() {
    this.stopSpeaking(); // pressing the key interrupts Claude mid-sentence
    this.pressCb();
    const wav = resolve(STATE_DIR, `ptt-${++this.recordingCount}.wav`); // its own file: the previous one may still be transcribing
    rmSync(wav, { force: true });
    this.current = {
      slot: this.merger.begin(),
      wav,
      startedAt: Date.now(),
      recorder: spawn(this.cfg.recordBin, ["-q", "-c", "1", "-r", "16000", "-b", "16", wav], { stdio: "ignore" }),
      limit: setTimeout(() => this.abandonRecording(), MAX_RECORDING_MS),
    };
    spawn("afplay", ["/System/Library/Sounds/Tink.aiff"], { stdio: "ignore" });
  }

  /** Safety net when the key's release never arrives: the mic goes off and nothing is sent. */
  private abandonRecording() {
    const recording = this.current;
    if (!recording) return;
    console.error(`[voice] still recording after ${MAX_RECORDING_MS / 1000}s; the key release was probably missed. Stopped, nothing sent.`);
    this.current = undefined; // first, so a late key release can't send the partial recording
    spawn("afplay", ["/System/Library/Sounds/Basso.aiff"], { stdio: "ignore" });
    void stopRecorder(recording).then(() => this.complete(recording, ""));
  }

  private async endRecording() {
    const recording = this.current!;
    this.current = undefined; // the key is free for the next recording while this one is stopped and transcribed
    const held = Date.now() - recording.startedAt;
    await stopRecorder(recording);
    if (held < MIN_RECORDING_MS) return this.complete(recording, ""); // accidental tap
    spawn("afplay", ["/System/Library/Sounds/Pop.aiff"], { stdio: "ignore" });
    this.complete(recording, await this.transcribeOrNothing(recording.wav));
  }

  private complete(recording: Recording, transcript: string) {
    rmSync(recording.wav, { force: true });
    this.merger.finish(recording.slot, transcript);
  }

  private async transcribeOrNothing(wav: string): Promise<string> {
    try {
      return await this.transcribe(wav);
    } catch (e) {
      console.error(`[whisper] ${(e as Error).message}`);
      return "";
    }
  }

  private async transcribe(wav: string): Promise<string> {
    const args = ["-m", this.cfg.whisperModel, "-f", wav, "-nt", "-np", "-l", this.cfg.language];
    const { stdout } = await run(this.cfg.whisperBin, args, { maxBuffer: 1 << 20 });
    const text = stdout.replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
    if (!text || /^\(?(blank_audio|silence|music)\)?$/i.test(text)) return "";
    console.log(`\n🎙  ${text}`);
    return text;
  }

  speak(text: string): Promise<void> {
    const clean = toSpeech(text);
    if (!clean) return Promise.resolve();
    console.log(`🔊 ${clean}`);
    this.stopSpeaking();
    const args = [];
    if (this.cfg.sayVoice) args.push("-v", this.cfg.sayVoice);
    if (this.cfg.sayRate) args.push("-r", String(this.cfg.sayRate));
    args.push(clean);
    const p = spawn("say", args, { stdio: "ignore" });
    this.sayProc = p;
    return new Promise((r) => p.once("close", () => r()));
  }

  stopSpeaking() {
    this.sayProc?.kill();
    this.sayProc = undefined;
  }
}

/** Keyboard-only mode for testing without audio: type instead of talking. */
export class TextVoice implements VoiceIO {
  private cb: (t: string) => void = () => {};
  private pressCb: () => void = () => {};
  onUtterance(cb: (text: string) => void) {
    this.cb = cb;
  }
  onPress(cb: () => void) {
    this.pressCb = cb;
  }
  isListening() {
    return false;
  }
  inputState(): VoiceInputState {
    return "idle";
  }
  async start() {
    const rl = createInterface({ input: process.stdin });
    rl.on("line", (l) => {
      if (!l.trim()) return;
      this.pressCb();
      this.cb(l.trim());
    });
    console.log("Text mode: type what you would say. Ctrl+C to quit.");
  }
  async speak(text: string) {
    console.log(`🔊 ${toSpeech(text)}`);
  }
  stopSpeaking() {}
}

/** Stops sox; if it ignores SIGINT (a stalled audio device), it is killed, so the mic is never left on. */
async function stopRecorder({ recorder, limit }: Recording) {
  clearTimeout(limit);
  await new Promise<void>((r) => {
    if (recorder.exitCode !== null || recorder.signalCode !== null) return r();
    const force = setTimeout(() => recorder.kill("SIGKILL"), RECORDER_STOP_GRACE_MS);
    recorder.once("close", () => (clearTimeout(force), r()));
    recorder.kill("SIGINT"); // sox finalizes the WAV header on SIGINT
  });
}
