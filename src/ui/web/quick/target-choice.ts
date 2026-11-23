// Who gets what you write in the quick panel: the one you picked while writing, else the one you sent to last, else the
// most recently active session. The one you sent to last is kept in the panel's own storage, so it survives restarts.

import { ASSISTANT_TARGET, defaultTargetOf, sessionTargetsOf, type QuickTarget } from "../../quick-targets.js";
import { localRead, localWrite } from "../dom.js";
import { store } from "../store.js";

const LAST_SENT_KEY = "quickPanelLastSentTo";
const NO_TARGET = "";

export class TargetChoice {
  private pickedId?: string;

  /** Every open session, the most recently active first. */
  sessions(): QuickTarget[] {
    return sessionTargetsOf(store.state.projects);
  }

  /** What the picker lists: the assistant, then the sessions. */
  everyone(): QuickTarget[] {
    return [ASSISTANT_TARGET, ...this.sessions()];
  }

  current(): QuickTarget {
    return defaultTargetOf(this.sessions(), this.pickedId ?? localRead(LAST_SENT_KEY));
  }

  pick(id: string): void {
    this.pickedId = id;
  }

  /** Back to the default, for a fresh start with an empty box. */
  forgetPick(): void {
    this.pickedId = undefined;
  }

  /** It becomes the default next time. */
  sentTo(id: string): void {
    localWrite(LAST_SENT_KEY, id);
    this.forgetPick();
  }

  /** The new session is the most recently active one, so it becomes the default. */
  sentToNewSession(): void {
    localWrite(LAST_SENT_KEY, NO_TARGET);
    this.forgetPick();
  }
}
