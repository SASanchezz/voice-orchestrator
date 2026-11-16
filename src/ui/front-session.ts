const NO_SESSION_IN_FRONT = "No project tab is in front.";

/**
 * The worker session of the project tab in the web UI page you are using. Your voice goes there instead of to the
 * assistant; with the assistant's tab open, or another app in front, there is none.
 */
export class FrontSession {
  private front?: { page: string; session: string };

  pageInFront(page: string, session: string): void {
    this.front = { page, session };
  }

  /** Another app or the assistant's tab came to the front, or the page closed; another page in front stays. */
  pageLeftFront(page: string): void {
    if (this.front?.page === page) this.front = undefined;
  }

  hasSession(): boolean {
    return this.front !== undefined;
  }

  session(): string {
    if (!this.front) throw new Error(NO_SESSION_IN_FRONT);
    return this.front.session;
  }
}
