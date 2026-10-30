import { KokoroTTS, type GenerateOptions } from "kokoro-js";
import type { AppConfig } from "../config/app-config.js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

type KokoroVoiceName = NonNullable<GenerateOptions["voice"]>;
type KokoroSettings = Pick<AppConfig["voice"], "kokoroVoice" | "kokoroSpeed">;

/** Turns one sentence into a WAV file. */
export interface SpeechSynthesizer {
  synthesize(sentence: string, wavPath: string): Promise<void>;
}

/** Kokoro-82M on this Mac's CPU; the first load downloads the model (~90 MB) into the Hugging Face cache. */
export class KokoroSynthesizer implements SpeechSynthesizer {
  private constructor(
    private tts: KokoroTTS,
    private options: GenerateOptions,
  ) {}

  static async load({ kokoroVoice, kokoroSpeed }: KokoroSettings): Promise<KokoroSynthesizer> {
    const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" });
    if (!isVoiceOf(tts, kokoroVoice)) throw new Error(`Kokoro has no voice "${kokoroVoice}"`);
    return new KokoroSynthesizer(tts, { voice: kokoroVoice, speed: kokoroSpeed });
  }

  async synthesize(sentence: string, wavPath: string): Promise<void> {
    const audio = await this.tts.generate(sentence, this.options);
    await audio.save(wavPath);
  }
}

function isVoiceOf(tts: KokoroTTS, name: string): name is KokoroVoiceName {
  return name in tts.voices;
}
