import { errorMessage } from "../../shared/errors.js";
import type { MessageWatch } from "./arrivals.js";

/** Every source with chats under `notify`; one that can't start is logged and the rest go on. */
export class MessageWatches {
  constructor(private watches: MessageWatch[]) {}

  start(): void {
    for (const watch of this.watches) void this.startOrLog(watch);
  }

  private async startOrLog(watch: MessageWatch): Promise<void> {
    try {
      await watch.start();
    } catch (error) {
      console.warn(`[messages] ${watch.name}: new messages won't be announced: ${errorMessage(error)}`);
    }
  }
}
