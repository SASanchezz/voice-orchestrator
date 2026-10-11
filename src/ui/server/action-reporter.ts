import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import type { Feed } from "../feed.js";

/** Shows a click's outcome in the feed and tells the model about it. */
export class ActionReporter {
  constructor(
    private feed: Feed,
    private orchestrator: Orchestrator,
  ) {}

  report(about: string, message: string): string {
    this.feed.add({ kind: "action", about, text: message });
    this.orchestrator.noteUiAction(message);
    return message;
  }

  reportAnswer(about: string | undefined, message: string, requestId: string): string {
    this.feed.add({ kind: "action", about, text: message });
    this.orchestrator.noteUiAction(`${message} (request ${requestId})`);
    return message;
  }

  reportTask(about: string, instruction: string, message: string): string {
    this.feed.add({ kind: "action", about, text: `Task sent: ${instruction}`, detail: message });
    this.orchestrator.noteUiAction(`Sent ${about} a task: ${instruction}`);
    return message;
  }
}
