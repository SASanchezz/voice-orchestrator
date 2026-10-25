import type { ReflexTable, TapAction } from "./reflex-table.js";
import type { GestureEvent } from "./sensor-event.js";

/** What gestures can do in the app. */
export interface GestureActions {
  beginTalk(): void;
  endTalk(): void;
  discard(): void;
  stopSpeaking(): void;
}

/** Hears what a sensor sees, and when the sensor stops. */
export interface SensorListener {
  receive(gesture: GestureEvent): void;
  sensorStopped(): void;
}

const TAPS: Record<TapAction, (actions: GestureActions) => void> = {
  start_talk: (actions) => actions.beginTalk(),
  end_talk: (actions) => actions.endTalk(),
  discard: (actions) => actions.discard(),
  stop_speaking: (actions) => actions.stopSpeaking(),
};

/**
 * Turns gestures into reflexes. Talk is either held (`hold: talk`) or started and ended by two gestures
 * (`tap: start_talk`, `tap: end_talk`). One talk hold at a time: a second hand showing the talk gesture is ignored.
 */
export class SensorRouter implements SensorListener {
  /** The hand holding talk, as `name/hand`. */
  private talkingHand?: string;

  constructor(
    private reflexes: ReflexTable,
    private actions: GestureActions,
  ) {}

  receive(gesture: GestureEvent): void {
    const reflex = this.reflexes.get(gesture.name);
    if (!reflex) return;
    if ("hold" in reflex) this.holdTalk(gesture);
    else if (gesture.phase !== "end") TAPS[reflex.tap](this.actions);
  }

  /** A sensor that dies while you talk would otherwise leave the mic on; when you aren't talking, this does nothing. */
  sensorStopped(): void {
    this.endTalk();
  }

  private holdTalk(gesture: GestureEvent): void {
    const hand = `${gesture.name}/${gesture.hand}`;
    if (gesture.phase === "start" && !this.talkingHand) this.beginTalk(hand);
    else if (gesture.phase === "end" && this.talkingHand === hand) this.endTalk();
  }

  private beginTalk(hand: string): void {
    this.talkingHand = hand;
    this.actions.beginTalk();
  }

  private endTalk(): void {
    this.talkingHand = undefined;
    this.actions.endTalk();
  }
}
