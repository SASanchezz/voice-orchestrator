import type { Input } from "./inputs.js";
import type { QuestionGate } from "./question-gate.js";

/** What the operator still has to handle: your words ahead of queued notifications. */
export class InputQueue {
  private inputs: Input[] = [];

  constructor(private gate: QuestionGate) {}

  add(input: Input): void {
    if (input.kind !== "user") {
      this.inputs.push(input);
      return;
    }
    // you speaking always jumps ahead of queued notifications
    const firstNonUser = this.inputs.findIndex((x) => x.kind !== "user");
    this.inputs.splice(firstNonUser === -1 ? this.inputs.length : firstNonUser, 0, input);
  }

  /** Takes the next input allowed to go now, if any. */
  takeReady(): Input | undefined {
    const index = this.inputs.findIndex((input) => this.gate.isReady(input));
    return index === -1 ? undefined : this.inputs.splice(index, 1)[0];
  }

  isEmpty(): boolean {
    return !this.inputs.length;
  }

  waitingNotifications(): number {
    return this.inputs.filter((input) => input.kind === "event").length;
  }
}
