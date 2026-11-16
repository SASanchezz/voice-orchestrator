import type { Orchestrator } from "../orchestrator/orchestrator.js";

type Announcer = Pick<Orchestrator, "announce">;

const LOG = "[wake word]";

/**
 * Says how training in the background ended, since the Train wake word window may be closed by then. The operator is
 * built after the training, so it is connected once it exists.
 */
export class TrainingNews {
  private announcer?: Announcer;

  connect(announcer: Announcer): void {
    this.announcer = announcer;
  }

  trained(reply: string): void {
    this.tell(`Wake word training finished. ${reply}`);
  }

  failed(reason: string): void {
    this.tell(`Wake word training failed: ${reason}`);
  }

  private tell(news: string): void {
    console.log(`${LOG} ${news}`);
    this.announcer?.announce(news, news);
  }
}
