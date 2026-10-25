import type { GestureProcess } from "./gesture-process.js";
import type { GestureMode, GestureSetting } from "./gesture-setting.js";

/** "unavailable": there is no mic for gestures to talk into (text mode). */
export type GestureState = GestureMode | "unavailable";

/** Camera gestures, as the web UI shows and switches them. */
export interface GestureControl {
  readonly state: GestureState;
  setMode(mode: GestureMode): string;
}

/** The camera gesture sensor, as far as switching it goes. */
export type Sensor = Pick<GestureProcess, "start" | "stop">;

const SWITCHED: Record<GestureMode, string> = {
  on: "Gestures on.",
  off: "Gestures off: the camera is not used.",
};

/** Turns camera gestures on and off. While off, the sensor isn't running, so the camera isn't used at all. */
export class GestureSwitch implements GestureControl {
  private mode: GestureMode;
  private build?: () => Sensor;
  private sensor?: Sensor;

  constructor(private setting: GestureSetting) {
    this.mode = setting.read();
  }

  get state(): GestureState {
    return this.mode;
  }

  /** Once the mic is ready: from then on the sensor runs exactly while the switch is on. */
  connect(build: () => Sensor): void {
    this.build = build;
    if (this.mode === "on") this.launch();
  }

  /** Remembered across restarts. A sensor that can't be built (no config/gestures.yaml) leaves the switch off. */
  setMode(mode: GestureMode): string {
    if (mode === "on") this.launch();
    else this.stop();
    this.mode = mode;
    this.setting.remember(mode);
    return SWITCHED[mode];
  }

  stop(): void {
    this.sensor?.stop();
    this.sensor = undefined;
  }

  private launch(): void {
    if (this.sensor || !this.build) return;
    this.sensor = this.build();
    this.sensor.start();
  }
}

/** Text mode: no mic, so no gestures. */
export class UnavailableGestures implements GestureControl {
  readonly state = "unavailable";

  setMode(mode: GestureMode): string {
    throw new Error(`Gestures can't be turned ${mode}: they talk into the mic, and text mode has none.`);
  }
}
