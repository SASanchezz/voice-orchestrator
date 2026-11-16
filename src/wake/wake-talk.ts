import type { SharedMic } from "../voice/shared-mic.js";

const LOG = "[wake word]";
/** A trained model's file may carry a version, e.g. hey_jarvis_v0.1. */
const MODEL_VERSION = /_v\d+(\.\d+)*$/;

/** What the wake listener reports that the app acts on. */
export interface WakeListener {
  /** It is listening for `model`, e.g. "oracle" or "hey_jarvis". */
  listening(model: string): void;
  heard(score: number): void;
  sensorStopped(): void;
}

type Mic = Pick<SharedMic, "start" | "release">;

/**
 * The wake word on the shared mic: hearing it starts a recording as pressing the talk key does. Pauses don't end it,
 * so you can stop to think: saying "finish" sends it, and Escape discards it. It is ignored while `isBusy`: you are
 * already talking or dictating. Said while the assistant speaks, it cuts it off, as pressing the talk key does.
 */
export class WakeTalk implements WakeListener {
  constructor(
    private mic: Mic,
    private isBusy: () => boolean,
  ) {}

  listening(model: string): void {
    console.log(`${LOG} on: say "${WakeTalk.phraseOf(model)}" to talk, then "finish" to send or Escape to discard`);
  }

  heard(score: number): void {
    if (this.isBusy()) {
      console.log(`${LOG} heard (${score}), ignored: you are already talking or dictating`);
      return;
    }
    console.log(`${LOG} heard (${score})`);
    this.mic.start("wake");
  }

  /** A listener that dies mid-message would otherwise leave the mic on; what was said is still sent. */
  sensorStopped(): void {
    this.mic.release("wake");
  }

  /** The words a model listens for, from its name: "hey_jarvis_v0.1" is "hey jarvis". */
  private static phraseOf(model: string): string {
    return model.replace(MODEL_VERSION, "").replaceAll("_", " ");
  }
}
