import { errorMessage } from "../../shared/errors.js";
import type { OpenTelegram } from "./telegram-port.js";

/** Long enough for GramJS's own connection retries, short enough that a dead network doesn't stay "checking". */
const ANSWER_TIMEOUT_MS = 30_000;
const MS_PER_SECOND = 1000;

/** How the check went: still running, Telegram accepted the login, or the reason it didn't. */
export type TelegramCheckOutcome = { state: "checking" } | { state: "connected" } | { state: "failed"; reason: string };

/**
 * Connects to Telegram once, at startup, to learn whether the saved login still works; nothing is read. It reuses
 * the catch-up's own connection, which signs in and checks the session with Telegram.
 */
export class TelegramCheck {
  private outcome: TelegramCheckOutcome = { state: "checking" };

  constructor(
    private open: OpenTelegram,
    private timeoutMs = ANSWER_TIMEOUT_MS,
  ) {}

  start(): void {
    void this.run();
  }

  result(): TelegramCheckOutcome {
    return this.outcome;
  }

  private async run(): Promise<void> {
    try {
      await Promise.race([this.connectAndClose(), this.timeout()]);
      this.outcome = { state: "connected" };
    } catch (error) {
      this.outcome = { state: "failed", reason: errorMessage(error) };
    }
  }

  private async connectAndClose(): Promise<void> {
    const chats = await this.open();
    await chats.close();
  }

  private async timeout(): Promise<never> {
    await new Promise((resolve) => setTimeout(resolve, this.timeoutMs).unref());
    throw new Error(`Telegram didn't answer within ${this.timeoutMs / MS_PER_SECOND} seconds.`);
  }
}
