/** What a context reset carries into the new session: a short handoff note, or nothing. */
export type ResetMode = "notes" | "nothing";

/** Resets and restarts the model asked for during a turn; carried out once its reply is done. */
export class ResetRequests {
  private reset?: ResetMode;
  private restart = false;

  requestReset(mode: ResetMode): void {
    this.reset = mode;
  }

  get requestedReset(): ResetMode | undefined {
    return this.reset;
  }

  clearReset(): void {
    this.reset = undefined;
  }

  requestRestart(): void {
    this.restart = true;
  }

  get restartRequested(): boolean {
    return this.restart;
  }

  clearRestart(): void {
    this.restart = false;
  }
}
