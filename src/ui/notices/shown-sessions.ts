/**
 * The worker session each open web UI page has on screen, by page. A task that ends in a session you are looking at
 * needs no notice panel: you saw it end.
 */
export class ShownSessions {
  private sessionByPage = new Map<string, string>();

  pageShows(page: string, session: string): void {
    this.sessionByPage.set(page, session);
  }

  /** The page shows the assistant, a project's To-do or Review, is hidden behind other tabs, or was closed. */
  pageShowsNoSession(page: string): void {
    this.sessionByPage.delete(page);
  }

  isShown(session: string): boolean {
    return [...this.sessionByPage.values()].includes(session);
  }
}
