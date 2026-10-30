import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "../config/app-config.js";
import { STATE_DIR } from "../config/paths.js";
import { KokoroSynthesizer } from "./kokoro-synthesizer.js";
import { LoadingSpeaker } from "./loading-speaker.js";
import type { Speaker } from "./repeating-speaker.js";
import { SaySpeaker } from "./say-speaker.js";
import { SentenceSpeaker } from "./sentence-speaker.js";
import { AfplayPlayer } from "./wav-player.js";

type VoiceSettings = AppConfig["voice"];

/** The voice that says replies: Kokoro, loaded in the background from startup, or macOS `say`. */
export function createSpeaker(settings: VoiceSettings): Speaker {
  if (settings.engine === "say") return new SaySpeaker(settings);
  return new LoadingSpeaker(loadKokoroOrSay(settings));
}

async function loadKokoroOrSay(settings: VoiceSettings): Promise<Speaker> {
  try {
    return await loadKokoro(settings);
  } catch (error) {
    console.warn(`🔇 Kokoro voice didn't load (${String(error)}); speaking with say instead`);
    return new SaySpeaker(settings);
  }
}

async function loadKokoro(settings: VoiceSettings): Promise<Speaker> {
  const synthesizer = await KokoroSynthesizer.load(settings);
  console.log(`🗣  Kokoro voice ready (${settings.kokoroVoice})`);
  return new SentenceSpeaker(synthesizer, new AfplayPlayer(), emptySpeechDir());
}

/** state/speech/, emptied of sentences a crash left behind. */
function emptySpeechDir(): string {
  const dir = join(STATE_DIR, "speech");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}
