// Plays a recording in the wake word review, with its row's playhead running across the waveform meanwhile.

import type { ClipAudio, PlayableClip } from "./wake-clip-audio.js";
import type { ReviewRenderer } from "./wake-review-render.js";

export class ReviewPlayer {
  constructor(
    private renderer: ReviewRenderer,
    private audio: ClipAudio,
  ) {}

  /** `index`: its row in the list on screen. */
  play(clip: PlayableClip, index: number): void {
    this.renderer.showPlaying(index, clip.buffer.duration);
    this.audio.play(clip, () => this.renderer.showStopped(index));
  }

  stop(): void {
    this.audio.stop();
  }
}
