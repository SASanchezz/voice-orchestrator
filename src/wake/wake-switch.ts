import type { WakeWordMode, WakeWordSetting } from "./wake-setting.js";

/** "unavailable": text mode, which has no mic to listen on. */
export type WakeWordState = WakeWordMode | "unavailable";

/** The wake word, as the web UI shows and switches it. */
export interface WakeWordControl {
  readonly state: WakeWordState;
  setMode(mode: WakeWordMode): string;
}

/** The wake listener, as far as switching it goes. */
export interface WakeListenerProcess {
  start(): void;
  stop(): void;
}

const SWITCHED: Record<WakeWordMode, string> = {
  on: "Wake word on: say it to start talking.",
  off: "Wake word off: the mic is used only while you talk.",
};

/** Turns the wake word on and off. While off, its listener isn't running, so the mic is open only while you talk. */
export class WakeSwitch implements WakeWordControl {
  private mode: WakeWordMode;
  private build?: () => WakeListenerProcess;
  private listener?: WakeListenerProcess;

  constructor(private setting: WakeWordSetting) {
    this.mode = setting.read();
  }

  get state(): WakeWordState {
    return this.mode;
  }

  /** Once the mic is ready: from then on the listener runs exactly while the switch is on. */
  connect(build: () => WakeListenerProcess): void {
    this.build = build;
    if (this.mode === "on") this.launch();
  }

  /** Remembered across restarts. */
  setMode(mode: WakeWordMode): string {
    if (mode === "on") this.launch();
    else this.stop();
    this.mode = mode;
    this.setting.remember(mode);
    return SWITCHED[mode];
  }

  stop(): void {
    this.listener?.stop();
    this.listener = undefined;
  }

  /**
   * The listener is off while `work` runs, so it neither hears a training recording nor holds a model being replaced;
   * then it starts again if the switch is on, with the model as it is by then.
   */
  async pausedDuring<Result>(work: () => Promise<Result>): Promise<Result> {
    this.stop();
    try {
      return await work();
    } finally {
      if (this.mode === "on") this.launch();
    }
  }

  private launch(): void {
    if (this.listener || !this.build) return;
    this.listener = this.build();
    this.listener.start();
  }
}

/** Text mode: no mic, so no wake word. */
export class UnavailableWakeWord implements WakeWordControl {
  readonly state = "unavailable";

  setMode(mode: WakeWordMode): string {
    throw new Error(`The wake word can't be turned ${mode}: it listens on the mic, and text mode has none.`);
  }
}
