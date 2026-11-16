// Your wake word recordings in the page, with Web Audio: fetched and decoded, then played one at a time.

import { analyseClip } from "../wake-clip-analysis.js";
import type { WakeRecordingView } from "../wake-recording-views.js";
import type { ReviewClip } from "../wake-review-state.js";
import { fetchWakeRecordings, wakeRecordingUrl } from "./api.js";

/** A recording with its decoded audio, ready to play at once. */
export interface PlayableClip extends ReviewClip {
  buffer: AudioBuffer;
}

/** Every recording, decoded and analysed for the review. */
export class ClipLoader {
  private decoder?: AudioContext;

  async loadAll(): Promise<PlayableClip[]> {
    const recordings = await fetchWakeRecordings();
    return await Promise.all(recordings.map((recording) => this.load(recording)));
  }

  private async load(recording: WakeRecordingView): Promise<PlayableClip> {
    const response = await fetch(wakeRecordingUrl(recording));
    if (!response.ok) throw new Error(`Couldn't load the recording ${recording.name}.`);
    this.decoder ??= new AudioContext();
    const buffer = await this.decoder.decodeAudioData(await response.arrayBuffer());
    const analysis = analyseClip(buffer.getChannelData(0), buffer.sampleRate, recording.label === "wake");
    return { recording, analysis, buffer };
  }
}

/** Plays one recording at a time: playing another cuts off the last. */
export class ClipAudio {
  private context?: AudioContext;
  private playing?: AudioBufferSourceNode;

  /** `onEnded` runs only when this one plays to its end, not when something cuts it off. */
  play(clip: PlayableClip, onEnded: () => void): void {
    this.stop();
    this.context ??= new AudioContext();
    const source = this.context.createBufferSource();
    source.buffer = clip.buffer;
    source.connect(this.context.destination);
    source.addEventListener("ended", () => this.ended(source, onEnded));
    this.playing = source;
    void this.context.resume(); // made outside a click, it starts suspended
    source.start();
  }

  stop(): void {
    const playing = this.playing;
    this.playing = undefined;
    playing?.stop();
  }

  private ended(source: AudioBufferSourceNode, onEnded: () => void): void {
    if (this.playing !== source) return;
    this.playing = undefined;
    onEnded();
  }
}
