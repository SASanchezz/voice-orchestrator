const FIRST_RESTART_DELAY_MS = 1000;
const MAX_RESTART_DELAY_MS = 30_000;

/** Crashes since the last turn that completed; each one in a row doubles the wait, so a session that dies on start can't spin. */
export class CrashBackoff {
  private streak = 0;

  /** The wait before restarting after this crash. */
  nextDelay(): number {
    const delay = Math.min(FIRST_RESTART_DELAY_MS * 2 ** this.streak, MAX_RESTART_DELAY_MS);
    this.streak++;
    return delay;
  }

  reset(): void {
    this.streak = 0;
  }
}
