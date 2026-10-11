import { errorMessage } from "../shared/errors.js";
import type { PermissionAnnouncer } from "./permission-announcer.js";
import type { ExplainCommand } from "./permission-types.js";
import type { WaitingRequests } from "./waiting-requests.js";

/** Writes a plain-language explanation onto a waiting request; the card and the pop-up show it once it arrives. */
export class PermissionExplanations {
  constructor(
    private waiting: WaitingRequests,
    private explainCommand: ExplainCommand,
    private announcer: PermissionAnnouncer,
  ) {}

  async attach(id: string, command: string): Promise<void> {
    const asked = this.waiting.find(id);
    if (!asked) return;
    const explanation = await this.explainOrNothing(asked.project, command);
    const pending = this.waiting.find(id);
    if (!pending) return; // answered meanwhile
    pending.explanation = explanation;
    pending.explaining = false;
    this.announcer.explained(pending);
  }

  private async explainOrNothing(project: string, command: string): Promise<string | undefined> {
    try {
      return (await this.explainCommand(project, command)) || undefined;
    } catch (e) {
      console.error(`[permissions] couldn't explain the command: ${errorMessage(e)}`);
      return undefined;
    }
  }
}
