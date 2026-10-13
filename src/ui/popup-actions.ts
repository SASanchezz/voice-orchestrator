import type { AppEvent } from "../events/app-events.js";
import type { PageTarget } from "./page-target.js";

/** What a pop-up's buttons do besides answering: open the web UI there, and stop what is said about its event. */
export interface PopupActions {
  openPage(target: PageTarget): Promise<void>;
  /** Stops speech as the talk key does, and drops what is still queued about the event. */
  silence(event: AppEvent): void;
}
