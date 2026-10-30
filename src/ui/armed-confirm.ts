// A two-step confirmation that disarms by itself: the first step arms one thing, for a while. It lives outside the page,
// because the page rebuilds its buttons on every state push. No imports, so the page bundles it and Node tests it.

export class ArmedConfirm {
  private armedId: string | undefined;
  private expiry: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly waitMs: number,
    private readonly changed: () => void,
  ) {}

  isArmed(id: string): boolean {
    return this.armedId === id;
  }

  /** Only one thing is armed at a time, and arming again restarts the wait. */
  arm(id: string): void {
    clearTimeout(this.expiry);
    this.armedId = id;
    this.expiry = setTimeout(() => this.cancel(), this.waitMs);
    this.changed();
  }

  cancel(): void {
    if (this.armedId === undefined) return;
    clearTimeout(this.expiry);
    this.armedId = undefined;
    this.changed();
  }
}
