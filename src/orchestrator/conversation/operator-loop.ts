import { sleep } from "../../shared/sleep.js";
import type { SessionLifecycle } from "../lifecycle/session-lifecycle.js";
import type { InputDispatcher } from "./input-dispatcher.js";
import type { InputQueue } from "./input-queue.js";
import type { Input } from "./inputs.js";

const USER_DONE_POLL_MS = 200;

/** Works through queued inputs one at a time; when the queue is empty, resets the context if that's due. */
export class OperatorLoop {
  private busy = false;

  constructor(
    private queue: InputQueue,
    private dispatcher: InputDispatcher,
    private lifecycle: SessionLifecycle,
  ) {}

  enqueue(input: Input): void {
    this.queue.add(input);
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (await this.restartedWhileDraining()) return;
      if (this.queue.isEmpty()) await this.lifecycle.maybeReset();
    } finally {
      this.busy = false;
    }
    if (!this.queue.isEmpty()) void this.pump();
  }

  /** Handles inputs until none is left. A restart asked for in a turn happens right after its reply is saved and spoken. */
  private async restartedWhileDraining(): Promise<boolean> {
    while (!this.queue.isEmpty()) {
      const input = this.queue.takeReady();
      if (!input) {
        await sleep(USER_DONE_POLL_MS);
        continue;
      }
      await this.dispatcher.handle(input);
      if (isTurn(input) && this.lifecycle.restartRequested()) {
        this.lifecycle.restart();
        return true;
      }
    }
    return false;
  }
}

function isTurn(input: Input): boolean {
  return input.kind === "user" || input.kind === "event";
}
