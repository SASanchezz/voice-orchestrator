import type { HoldAction, ReflexTable, TapAction } from "./reflex-table.js";
import type { GestureEvent } from "./sensor-event.js";

/** What gestures can do in the app. */
export interface GestureActions {
  beginTalk(): void;
  endTalk(): void;
  discard(): void;
  stopSpeaking(): void;
  repeatLast(): void;
  /** macOS Spaces: to the desktop on the left or right. */
  spaceLeft(): void;
  spaceRight(): void;
  /** The first hand starts pointing, and the last one stops. */
  pointStarted(): void;
  pointEnded(): void;
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
  repeat_last: (actions) => actions.repeatLast(),
  space_left: (actions) => actions.spaceLeft(),
  space_right: (actions) => actions.spaceRight(),
};

/**
 * Turns gestures into reflexes. Talk is either held (`hold: talk`) or started and ended by two gestures
 * (`tap: start_talk`, `tap: end_talk`). One talk hold at a time: a second hand showing the talk gesture is ignored.
 * One-shot gestures such as swipes only ever `tap`.
 */
export class SensorRouter implements SensorListener {
  /** The hand holding talk, as `name/hand`. */
  private talkingHand?: string;
  /** The hands pointing, as `name/hand`. */
  private pointingHands = new Set<string>();

  constructor(
    private reflexes: ReflexTable,
    private actions: GestureActions,
  ) {}

  receive(gesture: GestureEvent): void {
    const reflex = this.reflexes.get(gesture.name);
    if (!reflex) return;
    if ("hold" in reflex) this.hold(reflex.hold, gesture);
    else if (gesture.phase !== "end") this.tap(reflex.tap);
  }

  /** A sensor that dies while you talk would otherwise leave the mic on; when you aren't talking, this does nothing. */
  sensorStopped(): void {
    this.endTalk();
    if (this.pointingHands.size) this.actions.pointEnded();
    this.pointingHands.clear();
  }

  private tap(actions: readonly TapAction[]): void {
    for (const action of actions) TAPS[action](this.actions);
  }

  private hold(action: HoldAction, gesture: GestureEvent): void {
    if (action === "talk") this.holdTalk(gesture);
    else this.holdPoint(gesture);
  }

  private holdPoint(gesture: GestureEvent): void {
    const hand = `${gesture.name}/${gesture.hand}`;
    const wasPointing = this.pointingHands.size > 0;
    if (gesture.phase === "start") this.pointingHands.add(hand);
    else if (gesture.phase === "end") this.pointingHands.delete(hand);
    const isPointing = this.pointingHands.size > 0;
    if (isPointing && !wasPointing) this.actions.pointStarted();
    if (wasPointing && !isPointing) this.actions.pointEnded();
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
