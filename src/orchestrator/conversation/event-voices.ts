import type { AppEvent } from "../../events/app-events.js";
import type { VoiceIO } from "../../voice/voice-io.js";
import { SingleVoice } from "./single-voice.js";

/**
 * The one voice of each event with a pop-up (a task's end, a worker's questions), so clicking the pop-up
 * silences it wherever it is: queued, or being said. It stops speech the way the talk key does.
 */
export class EventVoices {
  private voices = new WeakMap<AppEvent, SingleVoice>();

  constructor(private speaker: Pick<VoiceIO, "stopSpeaking">) {}

  voiceOf(event: AppEvent): SingleVoice {
    const known = this.voices.get(event);
    if (known) return known;
    const voice = new SingleVoice(() => this.speaker.stopSpeaking());
    this.voices.set(event, voice);
    return voice;
  }

  silence(event: AppEvent): void {
    console.log(`🔇 ${event.label}: pop-up clicked, its speech stopped and dropped`);
    this.voiceOf(event).silence();
  }
}
